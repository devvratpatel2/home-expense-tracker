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
  const result = await db.execute({
    sql: `SELECT e.*, c.name as category_name FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.project_id = ? ORDER BY e.date DESC, e.created_at DESC`,
    args: [projectId],
  });
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
    sql: `INSERT INTO expenses (id, project_id, category_id, description, amount, date, vendor, payment_method, notes, receipt_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, body.project_id, body.category_id || null, body.description, body.amount,
      body.date, body.vendor || '', body.payment_method || '', body.notes || '', body.receipt_path || ''],
  });
  return NextResponse.json({ id });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  await initDb();
  const db = getDb();
  await db.execute({ sql: `DELETE FROM expenses WHERE id = ?`, args: [id] });
  return NextResponse.json({ success: true });
}
