import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';
import { getDb, initDb } from '@/lib/db';

export async function getUserId() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session.userId;
}

export async function ownsProject(userId: string, projectId: string | null) {
  if (!projectId) return false;
  await initDb();
  const result = await getDb().execute({ sql: `SELECT 1 FROM projects WHERE id = ? AND user_id = ?`, args: [projectId, userId] });
  return result.rows.length > 0;
}

// The owner, or someone the owner shared the project with. Viewers can read but never write,
// so every write route keeps using ownsProject.
export async function canViewProject(userId: string, projectId: string | null) {
  if (!projectId) return false;
  await initDb();
  const result = await getDb().execute({
    sql: `SELECT 1 FROM projects p WHERE p.id = ? AND (p.user_id = ? OR EXISTS (
      SELECT 1 FROM project_viewers v JOIN users u ON lower(u.email) = v.email WHERE v.project_id = p.id AND u.id = ?))`,
    args: [projectId, userId, userId],
  });
  return result.rows.length > 0;
}

// Looks up the project a row belongs to, so edits and deletes by id can be ownership-checked.
export async function projectOf(table: 'expenses' | 'categories' | 'progress_updates', id: string | null) {
  if (!id) return null;
  await initDb();
  const result = await getDb().execute({ sql: `SELECT project_id FROM ${table} WHERE id = ?`, args: [id] });
  return (result.rows[0]?.project_id as string) ?? null;
}
