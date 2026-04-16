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
  const result = await db.execute({ sql: `SELECT * FROM progress_updates WHERE project_id = ? ORDER BY date DESC`, args: [projectId] });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  await initDb();
  const db = getDb();
  const id = uuid();
  await db.execute({
    sql: `INSERT INTO progress_updates (id, project_id, title, description, phase, status, image_path, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, body.project_id, body.title, body.description || '', body.phase || '',
      body.status || 'in_progress', body.image_path || '', body.date],
  });
  return NextResponse.json({ id });
}
