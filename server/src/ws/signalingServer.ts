import { WebSocket } from 'ws';
import type { WebSocketServer } from 'ws';
import type { CallInviteMessage, SignalMessage } from './signalTypes.js';
import { sendIncomingCallPush } from '../services/pushService.js';

// In-memory registry: userId -> live socket.
// Fine for a single server instance. If you scale to multiple instances,
// this MUST move to Redis pub/sub (each instance subscribes to a channel
// per userId, or a shared channel filtered by targetUserId) — otherwise
// two users connected to different instances can never reach each other.
const connections = new Map<string, WebSocket>();

// userId -> last known FCM device token, so we can push-wake them even
// when they have no live WebSocket connection (app closed/backgrounded).
// Also in-memory — same multi-instance caveat as `connections` above,
// plus: this should really live in Postgres once that exists, since an
// in-memory token cache is wiped on every server restart/deploy.
const fcmTokens = new Map<string, string>();

// Tracks which userId owns which socket, for cleanup on disconnect.
const socketToUserId = new Map<WebSocket, string>();

const RELAYABLE_TYPES = new Set([
  'call:invite',
  'call:answer',
  'call:reject',
  'call:hangup',
  'ice:candidate',
]);

function send(socket: WebSocket, message: SignalMessage) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

export function attachSignalingServer(wss: WebSocketServer) {
  wss.on('connection', (socket: WebSocket) => {
    socket.on('message', (raw: Buffer) => {
      let message: SignalMessage;

      try {
        message = JSON.parse(raw.toString());
      } catch {
        send(socket, { type: 'error', message: 'Invalid JSON payload' });
        return;
      }

      // --- Registration: client announces its userId on this socket ---
      if (message.type === 'register') {
        const { userId } = message;

        if (!userId || typeof userId !== 'string') {
          send(socket, { type: 'error', message: 'register requires a valid userId' });
          return;
        }

        // If this user already had a connection (e.g. reconnect/refresh), replace it.
        const existing = connections.get(userId);
        if (existing && existing !== socket) {
          existing.close();
        }

        connections.set(userId, socket);
        socketToUserId.set(socket, userId);

        if (message.fcmToken) {
          fcmTokens.set(userId, message.fcmToken);
        }

        send(socket, { type: 'registered', userId });
        return;
      }

      // --- Relay: forward call signaling to the target user's socket ---
      if (RELAYABLE_TYPES.has(message.type)) {
        const toUserId = (message as { toUserId: string }).toUserId;
        const targetSocket = connections.get(toUserId);

        if (!targetSocket) {
          // No live WebSocket for this user — this is the "app closed/
          // backgrounded" case. For call invites specifically, fall back
          // to FCM push so the OS can wake the app via CallKeep. Other
          // message types (answer/reject/hangup/ice) just fail silently
          // here, since there's no "ringing UI" to wake for those.
          if (message.type === 'call:invite') {
            const fcmToken = fcmTokens.get(toUserId);
            const invite = message as CallInviteMessage;

            if (fcmToken) {
              sendIncomingCallPush({
                fcmToken,
                callId: invite.callId,
                callType: invite.callType,
                callerDisplayName: invite.callerDisplayName,
                callerPfpUrl: invite.callerPfpUrl,
              }).catch((err) => console.error('FCM push failed:', err));

              send(socket, { type: 'call:invite_pushed', callId: invite.callId, toUserId });
              return;
            }
          }

          send(socket, {
            type: 'error',
            message: `User ${toUserId} is not connected and has no push token on file`,
          });
          return;
        }

        send(targetSocket, message);
        return;
      }

      send(socket, { type: 'error', message: `Unknown message type: ${message.type}` });
    });

    socket.on('close', () => {
      const userId = socketToUserId.get(socket);
      if (userId) {
        connections.delete(userId);
        socketToUserId.delete(socket);
      }
    });

    socket.on('error', () => {
      socket.close();
    });
  });
}

/** Exposed for health checks / debugging — count of currently registered users. */
export function getConnectedUserCount(): number {
  return connections.size;
}
