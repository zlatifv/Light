import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with
  // `undefined` as the secret — that would make every session forgeable.
  throw new Error('JWT_SECRET environment variable is required');
}

export interface SessionPayload {
  userId: string;
  displayName: string;
}

export function issueSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifySessionToken(token: string): SessionPayload {
  return jwt.verify(token, JWT_SECRET) as SessionPayload;
}
