import { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: string;
  email?: string;
  name?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_for_home_tracker',
  cookieName: 'home-tracker-session',
  cookieOptions: { secure: process.env.NODE_ENV === 'production' },
};
