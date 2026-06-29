import { useState } from 'react';
import { CallOverlay } from './components/CallOverlay';
import type { CallSession, CallStatus } from './types/call';

const MOCK_SESSION_BASE: CallSession = {
  callId: 'demo-call-1',
  type: 'voice',
  status: 'ringing',
  caller: {
    userId: 'u1',
    displayName: 'You',
    pfpUrl: null,
    isMuted: false,
    isSpeaking: false,
  },
  receiver: {
    userId: 'u2',
    displayName: 'Alex Rivera',
    pfpUrl: 'https://i.pravatar.cc/300?img=12',
    isMuted: false,
    isSpeaking: false,
  },
  startedAt: null,
  durationSec: 0,
};

const STATUS_FLOW: CallStatus[] = ['ringing', 'connecting', 'connected', 'disconnected'];

export default function App() {
  const [callActive, setCallActive] = useState(false);
  const [isIncoming, setIsIncoming] = useState(false);
  const [session, setSession] = useState<CallSession>(MOCK_SESSION_BASE);

  const startCall = (type: 'voice' | 'video', incoming: boolean) => {
    setSession({ ...MOCK_SESSION_BASE, type, status: 'ringing' });
    setIsIncoming(incoming);
    setCallActive(true);
  };

  const cycleStatus = () => {
    const currentIndex = STATUS_FLOW.indexOf(session.status);
    const next = STATUS_FLOW[(currentIndex + 1) % STATUS_FLOW.length];
    setSession((s) => ({ ...s, status: next }));
  };

  const endCall = () => {
    setSession((s) => ({ ...s, status: 'disconnected' }));
    setTimeout(() => setCallActive(false), 600);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-zinc-950 text-white">
      <h1 className="text-3xl font-bold">Light — Call Overlay Demo</h1>
      <p className="max-w-md text-center text-sm text-zinc-400">
        No real WebRTC wired up yet — this just proves the UI + sounds work.
        "Incoming" plays the ringtone loop; "Outgoing" plays the dialtone loop.
        Tap the DEBUG button to advance the call state and hear the connect/disconnect chimes.
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={() => startCall('voice', false)}
          className="rounded-full bg-emerald-600 px-6 py-3 font-semibold hover:bg-emerald-700"
        >
          Outgoing Voice Call
        </button>
        <button
          onClick={() => startCall('video', false)}
          className="rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700"
        >
          Outgoing Video Call
        </button>
        <button
          onClick={() => startCall('voice', true)}
          className="rounded-full bg-purple-600 px-6 py-3 font-semibold hover:bg-purple-700"
        >
          Incoming Voice Call
        </button>
      </div>

      {callActive && (
        <>
          <CallOverlay
            session={session}
            localStream={null}
            remoteStream={null}
            isIncoming={isIncoming}
            onMuteToggle={() => console.log('mute toggled')}
            onSpeakerToggle={() => console.log('speaker toggled')}
            onVideoToggle={() => console.log('video toggled')}
            onEndCall={endCall}
          />
          {/* Dev-only control to manually step through call states */}
          <button
            onClick={cycleStatus}
            className="fixed bottom-4 left-4 z-[60] rounded-lg bg-yellow-500 px-3 py-2 text-xs font-bold text-black"
          >
            DEBUG: Next status (current: {session.status})
          </button>
        </>
      )}
    </div>
  );
}
