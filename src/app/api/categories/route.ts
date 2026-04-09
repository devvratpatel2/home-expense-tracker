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

export async function GET(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const db = await getDb();
  const result = db.exec(`SELECT * FROM categories WHERE project_id = '${projectId}' ORDER BY name`);
  if (!result.length) return NextResponse.json([]);

  const cats = result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    result[0].columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
  return NextResponse.json(cats);
}

export async function POST(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { project_id, name, budget } = await req.json();
  const db = await getDb();
  const id = uuid();
  db.run(`INSERT INTO categories (id, project_id, name, budget) VALUES (?, ?, ?, ?)`, [id, project_id, name, budget || 0]);
  saveDb();
  return NextResponse.json({ id });
}
