import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserId, ownsProject } from '@/lib/auth';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

// Only the owner of a project sees or changes who it is shared with.
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!(await ownsProject(userId, projectId))) return notFound();

  const result = await getDb().execute({
    sql: `SELECT v.email, v.created_at, u.name FROM project_viewers v
      LEFT JOIN users u ON lower(u.email) = v.email
      WHERE v.project_id = ? ORDER BY v.created_at`,
    args: [projectId],
  });
  return NextResponse.json(result.rows.map(r => ({ email: r.email, added: r.created_at, name: r.name ?? null })));
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { project_id, email } = await req.json();
  if (!(await ownsProject(userId, project_id))) return notFound();

  const clean = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });

  const db = getDb();
  const me = await db.execute({ sql: `SELECT lower(email) AS email FROM users WHERE id = ?`, args: [userId] });
  if (me.rows[0]?.email === clean) return NextResponse.json({ error: 'That is your own email' }, { status: 400 });

  await db.execute({ sql: `INSERT OR IGNORE INTO project_viewers (project_id, email) VALUES (?, ?)`, args: [project_id, clean] });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!(await ownsProject(userId, projectId))) return notFound();

  const email = String(req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  await getDb().execute({ sql: `DELETE FROM project_viewers WHERE project_id = ? AND email = ?`, args: [projectId, email] });
  return NextResponse.json({ success: true });
}
