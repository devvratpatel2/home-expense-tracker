import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { v4 as uuid } from 'uuid';

async function getUser() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session.userId;
}

export async function GET() {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const db = getDb();
  const result = await db.execute({ sql: `SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC`, args: [userId] });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, description, budget, start_date } = await req.json();
  await initDb();
  const db = getDb();
  const id = uuid();
  await db.execute({
    sql: `INSERT INTO projects (id, user_id, name, description, budget, start_date) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, userId, name, description || '', budget || 0, start_date || ''],
  });
  return NextResponse.json({ id });
}
