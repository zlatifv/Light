// Signaling protocol — messages exchanged over the WebSocket between
// two clients during call setup. The server only relays these by
// targetUserId; it never inspects SDP/ICE contents.

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
  /** FCM device token — lets the server push-wake this device when app is closed */
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
  sdpOffer: RTCSessionDescriptionInit;
  callerDisplayName: string;
  callerPfpUrl: string | null;
}

export interface CallAnswerMessage {
  type: 'call:answer';
  callId: string;
  fromUserId: string;
  toUserId: string;
  sdpAnswer: RTCSessionDescriptionInit;
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
  candidate: RTCIceCandidateInit;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

/** Sent back to the caller when their invite was delivered via FCM push
 *  instead of a live WebSocket, because the target's app is closed/backgrounded. */
export interface CallInvitePushedMessage {
  type: 'call:invite_pushed';
  callId: string;
  toUserId: string;
}
