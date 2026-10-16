import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { password, name, inviteCode } = body;
  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  if (String(password).length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  await initDb();
  const db = getDb();

  // The site is on a public URL. The first account can always be created, and so can an account
  // for an email someone shared a project with. Otherwise registering needs REGISTRATION_CODE
  // (or, with no code set, is only open when running locally).
  const userCount = Number((await db.execute(`SELECT COUNT(*) as n FROM users`)).rows[0].n);
  const invited = (await db.execute({ sql: `SELECT 1 FROM project_viewers WHERE email = ?`, args: [email] })).rows.length > 0;
  const requiredCode = process.env.REGISTRATION_CODE;
  const allowed = userCount === 0 || invited || (requiredCode ? inviteCode === requiredCode : process.env.NODE_ENV !== 'production');
  if (!allowed) {
    return NextResponse.json({ error: 'Registration is closed. Ask the owner to share their project with this email.' }, { status: 403 });
  }

  const existing = await db.execute({ sql: `SELECT id FROM users WHERE lower(email) = lower(?)`, args: [email] });
  if (existing.rows.length) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
  }

  const userId = uuid();
  const hash = bcrypt.hashSync(password, 10);
  await db.execute({ sql: `INSERT INTO users (id, email, name, password) VALUES (?, ?, ?, ?)`, args: [userId, email, name, hash] });

  // Invited people only follow someone else's build, so they don't get an empty project of their own.
  if (!invited) {
    const projectId = uuid();
    await db.execute({
      sql: `INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)`,
      args: [projectId, userId, 'My Home Build', 'My first home construction project'],
    });

    for (const cat of DEFAULT_CATEGORIES) {
      await db.execute({ sql: `INSERT INTO categories (id, project_id, name) VALUES (?, ?, ?)`, args: [uuid(), projectId, cat] });
    }
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = userId;
  session.email = email;
  session.name = name;
  await session.save();

  return NextResponse.json({ success: true });
}
