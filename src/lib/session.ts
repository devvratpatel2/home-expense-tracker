import { SessionOptions } from 'iron-session';
import { createHash } from 'crypto';

export interface SessionData {
  userId?: string;
  email?: string;
  name?: string;
}

// The cookie password must not be guessable from the public repo. Without SESSION_SECRET,
// derive it from the Turso token, which is already a secret in the deployed environment.
function sessionPassword() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.TURSO_AUTH_TOKEN) return createHash('sha256').update(`home-tracker-session:${process.env.TURSO_AUTH_TOKEN}`).digest('hex');
  return 'complex_password_at_least_32_characters_long_for_home_tracker';
}

export const sessionOptions: SessionOptions = {
  password: sessionPassword(),
  cookieName: 'home-tracker-session',
  cookieOptions: { secure: process.env.NODE_ENV === 'production' },
};
