import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getDb } from '@/lib/db';
import { getUserId, ownsProject } from '@/lib/auth';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });
const EXPIRY_DAYS = [7, 30];

// One link per project. Only the owner can see, create, replace or turn it off.
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!(await ownsProject(userId, projectId))) return notFound();

  const result = await getDb().execute({ sql: `SELECT token, created_at, expires_at, last_opened_at FROM share_links WHERE project_id = ?`, args: [projectId] });
  return NextResponse.json({ link: result.rows[0] ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}

// Creating a link when one exists replaces it, so the old address stops working.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { project_id, days } = await req.json();
  if (!(await ownsProject(userId, project_id))) return notFound();
  if (days !== null && !EXPIRY_DAYS.includes(days)) return NextResponse.json({ error: 'Pick 7 days, 30 days or no expiry' }, { status: 400 });

  const token = randomBytes(24).toString('base64url');
  const expires = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
  await getDb().execute({
    sql: `INSERT INTO share_links (project_id, token, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at, created_at = datetime('now'), last_opened_at = NULL`,
    args: [project_id, token, expires],
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!(await ownsProject(userId, projectId))) return notFound();

  await getDb().execute({ sql: `DELETE FROM share_links WHERE project_id = ?`, args: [projectId] });
  return NextResponse.json({ success: true });
}
