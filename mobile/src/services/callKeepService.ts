import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';

// CallKeep bridges to Android's ConnectionService (the same system telecom
// uses for real phone calls). This is what lets a call show up even when
// the app is closed/killed — Android itself renders the incoming-call UI,
// not our React code, once CallKeep registers our app as a calling app.

const callKeepOptions = {
  ios: {
    appName: 'Light',
  },
  android: {
    alertTitle: 'Permissions required',
    alertDescription: 'Light needs access to your phone accounts to handle calls.',
    cancelButton: 'Cancel',
    okButton: 'OK',
    imageName: 'ic_launcher',
    additionalPermissions: [],
    // selfManaged: true means WE render the call UI inside our own app
    // when the user taps the system notification, rather than letting
    // Android draw a totally native screen. This is more reliable across
    // OEM Android skins (Samsung/Xiaomi often break the non-selfManaged path).
    selfManaged: true,
  },
};

let isSetup = false;

export async function setupCallKeep() {
  if (isSetup) return;
  try {
    await RNCallKeep.setup(callKeepOptions);
    RNCallKeep.setAvailable(true);
    isSetup = true;
  } catch (err) {
    console.error('CallKeep setup failed:', err);
  }
}

/**
 * Tells Android to display the native/self-managed incoming call screen.
 * Call this from the FCM background message handler — it works even if
 * the app's JS was fully killed, because FCM delivers a high-priority
 * "data-only" message that triggers this from a headless JS task.
 */
export function displayIncomingCall(params: {
  callId: string;
  callerDisplayName: string;
  hasVideo: boolean;
}) {
  const { callId, callerDisplayName, hasVideo } = params;

  RNCallKeep.displayIncomingCall(
    callId,
    callerDisplayName,
    callerDisplayName,
    'generic',
    hasVideo
  );
}

export function endCall(callId: string) {
  RNCallKeep.endCall(callId);
}

export function answerCall(callId: string) {
  RNCallKeep.answerIncomingCall(callId);
}

/**
 * Registers listeners for CallKeep's native events — fired when the user
 * interacts with the OS-level call UI (answers, hangs up from the
 * notification/lock-screen, etc). Wire these to your WebRTC accept/reject logic.
 */
export function registerCallKeepListeners(handlers: {
  onAnswerCall: (callId: string) => void;
  onEndCall: (callId: string) => void;
  onToggleMute: (callId: string, muted: boolean) => void;
}) {
  RNCallKeep.addEventListener('answerCall', ({ callUUID }) => handlers.onAnswerCall(callUUID));
  RNCallKeep.addEventListener('endCall', ({ callUUID }) => handlers.onEndCall(callUUID));
  RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({ callUUID, muted }) =>
    handlers.onToggleMute(callUUID, muted)
  );
}

export function unregisterCallKeepListeners() {
  RNCallKeep.removeEventListener('answerCall');
  RNCallKeep.removeEventListener('endCall');
  RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
}

export const isCallKeepSupported = Platform.OS === 'android';
