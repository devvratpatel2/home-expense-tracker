import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  await initDb();
  const db = getDb();
  const existing = await db.execute({ sql: `SELECT id FROM users WHERE email = ?`, args: [email] });
  if (existing.rows.length) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
  }

  const userId = uuid();
  const hash = bcrypt.hashSync(password, 10);
  await db.execute({ sql: `INSERT INTO users (id, email, name, password) VALUES (?, ?, ?, ?)`, args: [userId, email, name, hash] });

  const projectId = uuid();
  await db.execute({
    sql: `INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)`,
    args: [projectId, userId, 'My Home Build', 'My first home construction project'],
  });

  for (const cat of DEFAULT_CATEGORIES) {
    await db.execute({ sql: `INSERT INTO categories (id, project_id, name) VALUES (?, ?, ?)`, args: [uuid(), projectId, cat] });
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = userId;
  session.email = email;
  session.name = name;
  await session.save();

  return NextResponse.json({ success: true });
}
