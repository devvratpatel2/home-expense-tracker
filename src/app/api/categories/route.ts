import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { canViewProject, getUserId, ownsProject, projectOf } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!(await canViewProject(userId, projectId))) return notFound();

  const result = await getDb().execute({
    sql: `SELECT c.*, COALESCE(SUM(e.amount), 0) as spent, COUNT(e.id) as expense_count
      FROM categories c LEFT JOIN expenses e ON e.category_id = c.id
      WHERE c.project_id = ? GROUP BY c.id ORDER BY c.name`,
    args: [projectId],
  });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { project_id, name, budget } = await req.json();
  if (!(await ownsProject(userId, project_id))) return notFound();
  if (!String(name || '').trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const id = uuid();
  await getDb().execute({ sql: `INSERT INTO categories (id, project_id, name, budget) VALUES (?, ?, ?, ?)`, args: [id, project_id, String(name).trim(), Number(budget) || 0] });
  return NextResponse.json({ id });
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id, name, budget } = await req.json();
  if (!(await ownsProject(userId, await projectOf('categories', id)))) return notFound();

  await getDb().execute({
    sql: `UPDATE categories SET name = COALESCE(?, name), budget = COALESCE(?, budget) WHERE id = ?`,
    args: [name ? String(name).trim() : null, budget === undefined ? null : Number(budget) || 0, id],
  });
  return NextResponse.json({ success: true });
}

// Deleting a category leaves its expenses in place as Uncategorized.
export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const id = req.nextUrl.searchParams.get('id');
  if (!(await ownsProject(userId, await projectOf('categories', id)))) return notFound();

  const db = getDb();
  await db.execute({ sql: `UPDATE expenses SET category_id = NULL WHERE category_id = ?`, args: [id] });
  await db.execute({ sql: `DELETE FROM categories WHERE id = ?`, args: [id] });
  return NextResponse.json({ success: true });
}
