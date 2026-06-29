import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import type { CallSession, CallStatus } from '../types/call';
import type { SignalMessage } from '../types/signal';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

// Same caveat as the web hook: STUN-only works for most home networks but
// not symmetric NAT. Add a TURN server here before relying on this across
// arbitrary networks (e.g. cellular-to-cellular calls).
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface UseWebRTCCallOptions {
  userId: string;
  displayName: string;
  pfpUrl: string | null;
  fcmToken: string | null;
  onIncomingCall?: (session: CallSession) => void;
}

interface PendingCallContext {
  callId: string;
  peerUserId: string;
}

export function useWebRTCCall({ userId, displayName, pfpUrl, fcmToken, onIncomingCall }: UseWebRTCCallOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<Extract<SignalMessage, { type: 'call:invite' }> | null>(
    null
  );

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCallRef = useRef<PendingCallContext | null>(null);
  const pendingIceCandidatesRef = useRef<any[]>([]);
  const handleSignalMessageRef = useRef<(message: SignalMessage) => void>(() => {});

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', userId, fcmToken: fcmToken ?? undefined }));
    };

    ws.onmessage = (event) => {
      const message: SignalMessage = JSON.parse(event.data);
      handleSignalMessageRef.current(message);
    };

    ws.onclose = () => setIsWsConnected(false);
    ws.onerror = () => setIsWsConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [userId, fcmToken]);

  const send = useCallback((message: SignalMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const createPeerConnection = useCallback(
    (toUserId: string, callId: string) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      // @ts-expect-error - react-native-webrtc event typing differs slightly from browser DOM types
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send({
            type: 'ice:candidate',
            callId,
            fromUserId: userId,
            toUserId,
            candidate: event.candidate,
          });
        }
      };

      // @ts-expect-error - same as above
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // @ts-expect-error - same as above
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') setStatus('connected');
        if (state === 'failed') setStatus('failed');
        if (state === 'disconnected' || state === 'closed') setStatus('disconnected');
      };

      pcRef.current = pc;
      return pc;
    },
    [send, userId]
  );

  const getLocalMedia = useCallback(async (callType: 'voice' | 'video') => {
    const stream = (await mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    })) as unknown as MediaStream;
    setLocalStream(stream);
    return stream;
  }, []);

  const startCall = useCallback(
    async (toUserId: string, callType: 'voice' | 'video') => {
      const callId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      pendingCallRef.current = { callId, peerUserId: toUserId };

      setStatus('connecting');
      const stream = await getLocalMedia(callType);

      const pc = createPeerConnection(toUserId, callId);
      // @ts-expect-error - addTrack/addStream signature differs slightly across RN versions
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      send({
        type: 'call:invite',
        callId,
        fromUserId: userId,
        toUserId,
        callType,
        sdpOffer: offer,
        callerDisplayName: displayName,
        callerPfpUrl: pfpUrl,
      });

      setStatus('ringing');
      return callId;
    },
    [createPeerConnection, displayName, getLocalMedia, pfpUrl, send, userId]
  );

  const acceptCall = useCallback(
    async (invite: Extract<SignalMessage, { type: 'call:invite' }>) => {
      setStatus('connecting');
      const stream = await getLocalMedia(invite.callType);

      const pc = createPeerConnection(invite.fromUserId, invite.callId);
      // @ts-expect-error - see above
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(invite.sdpOffer));

      for (const candidate of pendingIceCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingIceCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      send({
        type: 'call:answer',
        callId: invite.callId,
        fromUserId: userId,
        toUserId: invite.fromUserId,
        sdpAnswer: answer,
      });

      setPendingInvite(null);
    },
    [createPeerConnection, getLocalMedia, send, userId]
  );

  const rejectCall = useCallback(
    (invite: Extract<SignalMessage, { type: 'call:invite' }>, reason: 'declined' | 'busy' = 'declined') => {
      send({
        type: 'call:reject',
        callId: invite.callId,
        fromUserId: userId,
        toUserId: invite.fromUserId,
        reason,
      });
      setStatus('idle');
      setPendingInvite(null);
    },
    [send, userId]
  );

  const hangup = useCallback(() => {
    const ctx = pendingCallRef.current;
    if (ctx) {
      send({
        type: 'call:hangup',
        callId: ctx.callId,
        fromUserId: userId,
        toUserId: ctx.peerUserId,
      });
    }

    pcRef.current?.close();
    pcRef.current = null;
    // @ts-expect-error - getTracks exists on RN's MediaStream at runtime
    localStream?.getTracks().forEach((t: any) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setStatus('disconnected');
    pendingCallRef.current = null;
  }, [localStream, send, userId]);

  const handleSignalMessage = useCallback(
    (message: SignalMessage) => {
      switch (message.type) {
        case 'registered':
          setIsWsConnected(true);
          break;

        case 'call:invite': {
          pendingCallRef.current = { callId: message.callId, peerUserId: message.fromUserId };
          setStatus('ringing');
          setPendingInvite(message);
          onIncomingCall?.({
            callId: message.callId,
            type: message.callType,
            status: 'ringing',
            caller: {
              userId: message.fromUserId,
              displayName: message.callerDisplayName,
              pfpUrl: message.callerPfpUrl,
              isMuted: false,
              isSpeaking: false,
            },
            receiver: { userId, displayName, pfpUrl, isMuted: false, isSpeaking: false },
            startedAt: null,
            durationSec: 0,
          });
          break;
        }

        case 'call:answer': {
          pcRef.current
            ?.setRemoteDescription(new RTCSessionDescription(message.sdpAnswer))
            .then(async () => {
              for (const candidate of pendingIceCandidatesRef.current) {
                await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
              }
              pendingIceCandidatesRef.current = [];
            });
          break;
        }

        case 'ice:candidate': {
          if (pcRef.current?.remoteDescription) {
            pcRef.current.addIceCandidate(new RTCIceCandidate(message.candidate));
          } else {
            pendingIceCandidatesRef.current.push(message.candidate);
          }
          break;
        }

        case 'call:reject':
        case 'call:hangup': {
          pcRef.current?.close();
          pcRef.current = null;
          // @ts-expect-error - see above
          localStream?.getTracks().forEach((t: any) => t.stop());
          setLocalStream(null);
          setRemoteStream(null);
          setStatus('disconnected');
          pendingCallRef.current = null;
          break;
        }

        case 'call:invite_pushed':
          // Invite delivered via FCM push — callee's app was closed.
          // Nothing to do client-side; keep ringing.
          break;

        case 'error':
          console.error('Signaling error:', message.message);
          break;
      }
    },
    [displayName, localStream, onIncomingCall, pfpUrl, userId]
  );

  useEffect(() => {
    handleSignalMessageRef.current = handleSignalMessage;
  }, [handleSignalMessage]);

  return {
    localStream,
    remoteStream,
    status,
    isWsConnected,
    pendingInvite,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
  };
}
