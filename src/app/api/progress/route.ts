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

function rowsToObjects(result: { columns: string[]; values: unknown[][] }[]) {
  if (!result.length) return [];
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    result[0].columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
}

export async function GET(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const db = await getDb();
  const result = db.exec(`SELECT * FROM progress_updates WHERE project_id = '${projectId}' ORDER BY date DESC`);
  return NextResponse.json(rowsToObjects(result));
}

export async function POST(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = await getDb();
  const id = uuid();
  db.run(`INSERT INTO progress_updates (id, project_id, title, description, phase, status, image_path, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, body.project_id, body.title, body.description || '', body.phase || '',
    body.status || 'in_progress', body.image_path || '', body.date
  ]);
  saveDb();
  return NextResponse.json({ id });
}
