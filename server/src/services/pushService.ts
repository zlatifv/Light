import admin from 'firebase-admin';

// Initializes Firebase Admin using a service account JSON. Render: paste
// the full JSON contents into the FIREBASE_SERVICE_ACCOUNT env var (as a
// single-line string) rather than committing the file — see .env.example.
let initialized = false;

function ensureInitialized() {
  if (initialized) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn(
      'FIREBASE_SERVICE_ACCOUNT not set — push notifications to closed/backgrounded apps will not work.'
    );
    return;
  }

  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  initialized = true;
}

interface IncomingCallPushParams {
  fcmToken: string;
  callId: string;
  callType: 'voice' | 'video';
  callerDisplayName: string;
  callerPfpUrl: string | null;
}

/**
 * Sends a high-priority, data-only FCM message. Data-only (no "notification"
 * key) is required so Android delivers it to our background message handler
 * for headless processing, rather than letting the OS auto-render a generic
 * notification that bypasses our CallKeep logic.
 */
export async function sendIncomingCallPush(params: IncomingCallPushParams) {
  ensureInitialized();
  if (!initialized) return;

  const { fcmToken, callId, callType, callerDisplayName, callerPfpUrl } = params;

  await admin.messaging().send({
    token: fcmToken,
    android: {
      priority: 'high',
    },
    data: {
      type: 'incoming_call',
      callId,
      callType,
      callerDisplayName,
      callerPfpUrl: callerPfpUrl ?? '',
    },
  });
}
