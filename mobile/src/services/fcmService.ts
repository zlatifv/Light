import messaging from '@react-native-firebase/messaging';
import { displayIncomingCall } from './callKeepService';

/**
 * Requests notification permission and returns the device's FCM token.
 * This token must be sent to your backend (see useWebRTCCall's register
 * message) so the server knows where to deliver push notifications for
 * this specific device.
 */
export async function requestPushPermissionAndGetToken(): Promise<string | null> {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.warn('Push notification permission denied');
    return null;
  }

  const token = await messaging().getToken();
  return token;
}

/**
 * Registers the background + killed-state message handler.
 *
 * CRITICAL: this must be called at the TOP LEVEL of index.js, outside any
 * component or App() function. React Native's "headless JS" mechanism
 * only works if this handler is registered before the app's render tree
 * even starts — that's what lets it fire while the app is fully closed.
 */
export function registerBackgroundMessageHandler() {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    const data = remoteMessage.data;

    if (data?.type === 'incoming_call') {
      displayIncomingCall({
        callId: String(data.callId),
        callerDisplayName: String(data.callerDisplayName || 'Unknown'),
        hasVideo: data.callType === 'video',
      });
    }
    // Other notification types (new message, etc) would branch here too —
    // not built yet since there's no chat persistence/backend for it.
  });
}

/**
 * Foreground listener — fires while the app is open and active.
 * Background/killed state is handled separately above.
 */
export function registerForegroundMessageHandler(
  onIncomingCall: (data: { callId: string; callerDisplayName: string; callType: 'voice' | 'video' }) => void
) {
  return messaging().onMessage(async (remoteMessage) => {
    const data = remoteMessage.data;
    if (data?.type === 'incoming_call') {
      onIncomingCall({
        callId: String(data.callId),
        callerDisplayName: String(data.callerDisplayName || 'Unknown'),
        callType: data.callType === 'video' ? 'video' : 'voice',
      });
    }
  });
}

/** Re-fetch token when Firebase rotates it (happens periodically). */
export function onTokenRefresh(callback: (token: string) => void) {
  return messaging().onTokenRefresh(callback);
}
