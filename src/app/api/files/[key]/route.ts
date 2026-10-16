import { NextRequest, NextResponse } from 'next/server';
import { canViewProject, getUserId } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const db = getDb();
  const result = await db.execute({ sql: `SELECT user_id, content_type, data FROM files WHERE key = ?`, args: [params.key] });
  const row = result.rows[0];
  if (!row || !(row.user_id === userId || (await sharedWith(userId, row.user_id as string, `/api/files/${params.key}`)))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new NextResponse(row.data as ArrayBuffer, {
    headers: { 'Content-Type': row.content_type as string, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}

// A viewer can open a receipt or progress photo only when it is attached to a project they can see,
// and that project belongs to whoever uploaded the file. The second check stops someone from
// pointing an expense in their own project at another person's file.
async function sharedWith(userId: string, fileOwner: string, path: string) {
  const projects = await getDb().execute({
    sql: `SELECT id FROM projects WHERE user_id = ? AND (
      id IN (SELECT project_id FROM expenses WHERE receipt_path = ?) OR
      id IN (SELECT project_id FROM progress_updates WHERE image_path = ?))`,
    args: [fileOwner, path, path],
  });
  for (const p of projects.rows) {
    if (await canViewProject(userId, p.id as string)) return true;
  }
  return false;
}
