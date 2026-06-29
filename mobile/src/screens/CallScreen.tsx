import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Video, VideoOff } from 'lucide-react-native';
import type { CallSession } from '../types/call';

interface CallScreenProps {
  session: CallSession;
  localStream: any;
  remoteStream: any;
  onMuteToggle: () => void;
  onSpeakerToggle: () => void;
  onVideoToggle: () => void;
  onEndCall: () => void;
}

export function CallScreen({
  session,
  localStream,
  remoteStream,
  onMuteToggle,
  onSpeakerToggle,
  onVideoToggle,
  onEndCall,
}: CallScreenProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(session.type === 'video');
  const [elapsed, setElapsed] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (session.status !== 'ringing') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [session.status]);

  useEffect(() => {
    if (session.status !== 'connected') return;
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [session.status]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const statusLabel: Record<string, string> = {
    idle: '',
    ringing: 'Ringing…',
    connecting: 'Connecting…',
    connected: formatTime(elapsed),
    disconnected: 'Call ended',
    failed: 'Connection failed',
  };

  return (
    <View style={styles.container}>
      {session.type === 'video' && remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={StyleSheet.absoluteFillObject}
          objectFit="cover"
        />
      )}

      {session.type === 'video' && isVideoOn && localStream && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localPip}
          objectFit="cover"
          mirror
        />
      )}

      <View style={styles.centerContent}>
        {(session.type === 'voice' || !remoteStream) && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Image
              source={{ uri: session.receiver.pfpUrl ?? undefined }}
              style={styles.avatar}
            />
          </Animated.View>
        )}
        <Text style={styles.name}>{session.receiver.displayName}</Text>
        <Text style={styles.status}>{statusLabel[session.status]}</Text>
      </View>

      <View style={styles.actionBar}>
        <ActionButton
          active={isMuted}
          onPress={() => {
            setIsMuted((v) => !v);
            onMuteToggle();
          }}
          icon={isMuted ? <MicOff size={22} color={isMuted ? '#000' : '#fff'} /> : <Mic size={22} color="#fff" />}
        />

        {session.type === 'video' && (
          <ActionButton
            active={!isVideoOn}
            onPress={() => {
              setIsVideoOn((v) => !v);
              onVideoToggle();
            }}
            icon={isVideoOn ? <Video size={22} color="#fff" /> : <VideoOff size={22} color="#000" />}
          />
        )}

        <TouchableOpacity onPress={onEndCall} style={styles.endCallButton}>
          <PhoneOff size={26} color="#fff" />
        </TouchableOpacity>

        <ActionButton
          active={isSpeakerOn}
          onPress={() => {
            setIsSpeakerOn((v) => !v);
            onSpeakerToggle();
          }}
          icon={isSpeakerOn ? <Volume2 size={22} color="#000" /> : <VolumeX size={22} color="#fff" />}
        />
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.actionButton, active ? styles.actionButtonActive : styles.actionButtonInactive]}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  localPip: {
    position: 'absolute',
    right: 16,
    top: 64,
    width: 112,
    height: 160,
    borderRadius: 12,
    zIndex: 10,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
    color: '#a1a1aa',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 48,
    paddingTop: 24,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonActive: {
    backgroundColor: '#fff',
  },
  actionButtonInactive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
