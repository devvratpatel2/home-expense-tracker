import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import { getUserId, ownsProject } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  await initDb();
  const result = await getDb().execute({ sql: `SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC`, args: [userId] });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { name, description, budget, start_date } = await req.json();
  await initDb();
  const id = uuid();
  await getDb().execute({
    sql: `INSERT INTO projects (id, user_id, name, description, budget, start_date) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, userId, name, description || '', Number(budget) || 0, start_date || ''],
  });
  return NextResponse.json({ id });
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id, name, budget } = await req.json();
  if (!(await ownsProject(userId, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await getDb().execute({
    sql: `UPDATE projects SET name = COALESCE(?, name), budget = COALESCE(?, budget) WHERE id = ?`,
    args: [name ? String(name).trim() : null, budget === undefined ? null : Number(budget) || 0, id],
  });
  return NextResponse.json({ success: true });
}
