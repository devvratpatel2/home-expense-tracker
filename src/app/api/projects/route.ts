import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';
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

  const db = await getDb();
  const result = db.exec(`SELECT * FROM projects WHERE user_id = '${userId}' ORDER BY created_at DESC`);
  if (!result.length) return NextResponse.json([]);

  const projects = result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    result[0].columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, description, budget, start_date } = await req.json();
  const db = await getDb();
  const id = uuid();
  db.run(`INSERT INTO projects (id, user_id, name, description, budget, start_date) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, userId, name, description || '', budget || 0, start_date || '']);
  saveDb();
  return NextResponse.json({ id });
}
