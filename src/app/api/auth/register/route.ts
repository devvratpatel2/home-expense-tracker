import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';
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

  const db = await getDb();
  const existing = db.exec(`SELECT id FROM users WHERE email = '${email.replace(/'/g, "''")}'`);
  if (existing.length > 0 && existing[0].values.length > 0) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
  }

  const userId = uuid();
  const hash = bcrypt.hashSync(password, 10);
  db.run(`INSERT INTO users (id, email, name, password) VALUES (?, ?, ?, ?)`, [userId, email, name, hash]);

  // Create a default project
  const projectId = uuid();
  db.run(`INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)`, [
    projectId, userId, 'My Home Build', 'My first home construction project'
  ]);

  // Add default categories
  for (const cat of DEFAULT_CATEGORIES) {
    db.run(`INSERT INTO categories (id, project_id, name) VALUES (?, ?, ?)`, [uuid(), projectId, cat]);
  }

  saveDb();

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = userId;
  session.email = email;
  session.name = name;
  await session.save();

  return NextResponse.json({ success: true });
}
