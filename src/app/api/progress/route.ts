import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserId, ownsProject } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!(await ownsProject(userId, projectId))) return notFound();

  const result = await getDb().execute({ sql: `SELECT * FROM progress_updates WHERE project_id = ? ORDER BY date DESC`, args: [projectId] });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  if (!(await ownsProject(userId, body.project_id))) return notFound();

  const id = uuid();
  await getDb().execute({
    sql: `INSERT INTO progress_updates (id, project_id, title, description, phase, status, image_path, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, body.project_id, body.title, body.description || '', body.phase || '',
      body.status || 'in_progress', body.image_path || '', body.date],
  });
  return NextResponse.json({ id });
}
