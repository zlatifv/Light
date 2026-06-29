export type CallStatus =
  | 'idle'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed';

export interface CallParticipant {
  userId: string;
  displayName: string;
  pfpUrl: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
}

export interface CallSession {
  callId: string;
  type: 'voice' | 'video';
  status: CallStatus;
  caller: CallParticipant;
  receiver: CallParticipant;
  startedAt: number | null;
  durationSec: number;
}
