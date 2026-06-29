import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CallScreen } from './src/screens/CallScreen';
import { useWebRTCCall } from './src/hooks/useWebRTCCall';
import {
  setupCallKeep,
  registerCallKeepListeners,
  unregisterCallKeepListeners,
  displayIncomingCall,
  endCall as endCallKeepCall,
} from './src/services/callKeepService';
import {
  requestPushPermissionAndGetToken,
  registerForegroundMessageHandler,
  onTokenRefresh,
} from './src/services/fcmService';
import type { CallSession } from './src/types/call';

// Demo "login" — replace with real auth once that exists.
// To test: install this APK on two devices (or one device + the web app),
// and use different user ids.
const DEMO_USER_ID = 'alice'; // change per-device when testing

export default function App() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState('bob');
  const [incomingSession, setIncomingSession] = useState<CallSession | null>(null);
  const [activeCallType, setActiveCallType] = useState<'voice' | 'video'>('voice');
  const [callStarted, setCallStarted] = useState(false);

  const callIdRef = useRef<string | null>(null);

  const {
    localStream,
    remoteStream,
    status,
    isWsConnected,
    pendingInvite,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
  } = useWebRTCCall({
    userId: DEMO_USER_ID,
    displayName: DEMO_USER_ID,
    pfpUrl: `https://i.pravatar.cc/300?u=${DEMO_USER_ID}`,
    fcmToken,
    onIncomingCall: (session) => {
      callIdRef.current = session.callId;
      setIncomingSession(session);
      setCallStarted(true);
      // Foreground case — app is open, show CallKeep's native UI too so
      // the experience is consistent whether the app was open or closed.
      displayIncomingCall({
        callId: session.callId,
        callerDisplayName: session.caller.displayName,
        hasVideo: session.type === 'video',
      });
    },
  });

  // --- One-time native setup: CallKeep + FCM permission + token ---
  useEffect(() => {
    setupCallKeep();

    requestPushPermissionAndGetToken().then((token) => {
      if (token) setFcmToken(token);
    });

    const unsubscribeTokenRefresh = onTokenRefresh((token) => setFcmToken(token));

    const unsubscribeForeground = registerForegroundMessageHandler((data) => {
      // A push arrived while the app was in the foreground. The WebSocket
      // 'call:invite' path above already handles UI for that case in most
      // flows; this handler exists for the case where push arrives slightly
      // ahead of the WS message (race that does happen in practice).
      callIdRef.current = data.callId;
    });

    registerCallKeepListeners({
      onAnswerCall: (callId) => {
        if (pendingInvite) acceptCall(pendingInvite);
      },
      onEndCall: (callId) => {
        handleHangup();
      },
      onToggleMute: (_callId, muted) => {
        localStream?.getAudioTracks().forEach((t: any) => (t.enabled = !muted));
      },
    });

    return () => {
      unsubscribeTokenRefresh();
      unsubscribeForeground();
      unregisterCallKeepListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartCall = async (callType: 'voice' | 'video') => {
    setActiveCallType(callType);
    setCallStarted(true);
    const callId = await startCall(targetUserId, callType);
    callIdRef.current = callId;
  };

  const handleAccept = async () => {
    if (pendingInvite) {
      await acceptCall(pendingInvite);
    }
  };

  const handleReject = () => {
    if (pendingInvite) {
      rejectCall(pendingInvite);
      if (callIdRef.current) endCallKeepCall(callIdRef.current);
      setCallStarted(false);
      setIncomingSession(null);
    }
  };

  const handleHangup = () => {
    hangup();
    if (callIdRef.current) endCallKeepCall(callIdRef.current);
    setTimeout(() => {
      setCallStarted(false);
      setIncomingSession(null);
    }, 600);
  };

  const displaySession: CallSession = incomingSession ?? {
    callId: callIdRef.current ?? 'outgoing',
    type: activeCallType,
    status,
    caller: {
      userId: DEMO_USER_ID,
      displayName: DEMO_USER_ID,
      pfpUrl: `https://i.pravatar.cc/300?u=${DEMO_USER_ID}`,
      isMuted: false,
      isSpeaking: false,
    },
    receiver: {
      userId: targetUserId,
      displayName: targetUserId,
      pfpUrl: `https://i.pravatar.cc/300?u=${targetUserId}`,
      isMuted: false,
      isSpeaking: false,
    },
    startedAt: null,
    durationSec: 0,
  };

  const sessionWithLiveStatus: CallSession = { ...displaySession, status };

  if (callStarted && status !== 'idle') {
    return (
      <CallScreen
        session={sessionWithLiveStatus}
        localStream={localStream}
        remoteStream={remoteStream}
        onMuteToggle={() => {
          localStream?.getAudioTracks().forEach((t: any) => (t.enabled = !t.enabled));
        }}
        onSpeakerToggle={() => {
          // Wire to InCallManager.setForceSpeakerphoneOn for real speaker
          // toggling — not included here to keep this build scoped to
          // CallKeep + FCM; see alert notes below.
        }}
        onVideoToggle={() => {
          localStream?.getVideoTracks().forEach((t: any) => (t.enabled = !t.enabled));
        }}
        onEndCall={handleHangup}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Light</Text>

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: isWsConnected ? '#10b981' : '#dc2626' }]} />
        <Text style={styles.statusText}>
          Signed in as {DEMO_USER_ID} — {isWsConnected ? 'connected' : 'connecting…'}
        </Text>
      </View>

      <Text style={styles.hint}>
        FCM token: {fcmToken ? `${fcmToken.slice(0, 20)}…` : 'requesting…'}
      </Text>

      <TextInput
        value={targetUserId}
        onChangeText={setTargetUserId}
        placeholder="Call user id"
        placeholderTextColor="#71717a"
        style={styles.input}
      />

      <TouchableOpacity
        onPress={() => handleStartCall('voice')}
        disabled={!isWsConnected}
        style={[styles.button, styles.voiceButton, !isWsConnected && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>Call {targetUserId} (Voice)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleStartCall('video')}
        disabled={!isWsConnected}
        style={[styles.button, styles.videoButton, !isWsConnected && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>Call {targetUserId} (Video)</Text>
      </TouchableOpacity>

      {pendingInvite && status === 'ringing' && incomingSession && (
        <View style={styles.incomingBanner}>
          <Text style={styles.incomingText}>
            Incoming {incomingSession.type} call from {incomingSession.caller.displayName}
          </Text>
          <View style={styles.incomingButtons}>
            <TouchableOpacity onPress={handleAccept} style={styles.acceptButton}>
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReject} style={styles.declineButton}>
              <Text style={styles.buttonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  title: { fontSize: 32, fontWeight: '700', color: '#fff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#a1a1aa', fontSize: 13 },
  hint: { color: '#52525b', fontSize: 11 },
  input: {
    width: '100%',
    backgroundColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
  },
  button: { width: '100%', borderRadius: 28, paddingVertical: 14, alignItems: 'center' },
  voiceButton: { backgroundColor: '#059669' },
  videoButton: { backgroundColor: '#2563eb' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  incomingBanner: {
    position: 'absolute',
    top: 64,
    left: 16,
    right: 16,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  incomingText: { color: '#fff', fontSize: 14 },
  incomingButtons: { flexDirection: 'row', gap: 12 },
  acceptButton: { flex: 1, backgroundColor: '#059669', borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  declineButton: { flex: 1, backgroundColor: '#dc2626', borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
});
