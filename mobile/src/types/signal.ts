export type SignalMessage =
  | RegisterMessage
  | CallInviteMessage
  | CallAnswerMessage
  | CallRejectMessage
  | CallHangupMessage
  | IceCandidateMessage
  | ErrorMessage
  | RegisteredAckMessage
  | CallInvitePushedMessage;

export interface RegisterMessage {
  type: 'register';
  userId: string;
  /** FCM device token — lets the backend wake this device via push when app is closed */
  fcmToken?: string;
}

export interface RegisteredAckMessage {
  type: 'registered';
  userId: string;
}

export interface CallInviteMessage {
  type: 'call:invite';
  callId: string;
  fromUserId: string;
  toUserId: string;
  callType: 'voice' | 'video';
  sdpOffer: any;
  callerDisplayName: string;
  callerPfpUrl: string | null;
}

export interface CallAnswerMessage {
  type: 'call:answer';
  callId: string;
  fromUserId: string;
  toUserId: string;
  sdpAnswer: any;
}

export interface CallRejectMessage {
  type: 'call:reject';
  callId: string;
  fromUserId: string;
  toUserId: string;
  reason?: 'declined' | 'busy' | 'no-answer';
}

export interface CallHangupMessage {
  type: 'call:hangup';
  callId: string;
  fromUserId: string;
  toUserId: string;
}

export interface IceCandidateMessage {
  type: 'ice:candidate';
  callId: string;
  fromUserId: string;
  toUserId: string;
  candidate: any;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export interface CallInvitePushedMessage {
  type: 'call:invite_pushed';
  callId: string;
  toUserId: string;
}
