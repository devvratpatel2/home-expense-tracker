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

export async function GET(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  await initDb();
  const db = getDb();
  const result = await db.execute({ sql: `SELECT * FROM categories WHERE project_id = ? ORDER BY name`, args: [projectId] });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { project_id, name, budget } = await req.json();
  await initDb();
  const db = getDb();
  const id = uuid();
  await db.execute({ sql: `INSERT INTO categories (id, project_id, name, budget) VALUES (?, ?, ?, ?)`, args: [id, project_id, name, budget || 0] });
  return NextResponse.json({ id });
}
