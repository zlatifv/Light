import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Video, VideoOff } from 'lucide-react';
import type { CallSession } from '../types/call';
import { useCallSounds } from '../hooks/useCallSounds';

interface CallOverlayProps {
  session: CallSession;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** True if this device is the one receiving the call (plays ringtone vs dialtone) */
  isIncoming?: boolean;
  onMuteToggle: () => void;
  onSpeakerToggle: () => void;
  onVideoToggle: () => void;
  onEndCall: () => void;
}

export function CallOverlay({
  session,
  localStream,
  remoteStream,
  isIncoming = false,
  onMuteToggle,
  onSpeakerToggle,
  onVideoToggle,
  onEndCall,
}: CallOverlayProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(session.type === 'video');
  const [elapsed, setElapsed] = useState(0);
  const { playTap } = useCallSounds(session.status, isIncoming);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

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

  const statusLabel: Record<CallSession['status'], string> = {
    idle: '',
    ringing: 'Ringing…',
    connecting: 'Connecting…',
    connected: formatTime(elapsed),
    disconnected: 'Call ended',
    failed: 'Connection failed',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-zinc-900 to-black">
      {/* Remote video fullscreen (video calls only) */}
      {session.type === 'video' && remoteStream && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Local PIP (video calls only) */}
      {session.type === 'video' && isVideoOn && localStream && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute right-4 top-16 h-40 w-28 rounded-xl object-cover ring-2 ring-white/20 z-10"
        />
      )}

      {/* Header: PFP + name + status */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        {(session.type === 'voice' || !remoteStream) && (
          <div className="relative">
            <img
              src={session.receiver.pfpUrl ?? '/default-avatar.png'}
              alt={session.receiver.displayName}
              className="h-32 w-32 rounded-full object-cover ring-4 ring-white/10"
            />
            {session.status === 'ringing' && (
              <span className="absolute inset-0 animate-ping rounded-full ring-4 ring-emerald-400/40" />
            )}
          </div>
        )}
        <h2 className="text-2xl font-semibold text-white">
          {session.receiver.displayName}
        </h2>
        <p className="text-sm font-medium text-zinc-400">
          {statusLabel[session.status]}
        </p>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-center gap-6 pb-12 pt-6">
        <ActionButton
          active={isMuted}
          onClick={() => {
            setIsMuted((v) => !v);
            onMuteToggle();
            playTap();
          }}
          icon={isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        />

        {session.type === 'video' && (
          <ActionButton
            active={!isVideoOn}
            onClick={() => {
              setIsVideoOn((v) => !v);
              onVideoToggle();
              playTap();
            }}
            icon={isVideoOn ? <Video size={22} /> : <VideoOff size={22} />}
          />
        )}

        <button
          onClick={onEndCall}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700 active:scale-95"
        >
          <PhoneOff size={26} />
        </button>

        <ActionButton
          active={isSpeakerOn}
          onClick={() => {
            setIsSpeakerOn((v) => !v);
            onSpeakerToggle();
            playTap();
          }}
          icon={isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
        />
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 ${
        active ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'
      }`}
    >
      {icon}
    </button>
  );
}
