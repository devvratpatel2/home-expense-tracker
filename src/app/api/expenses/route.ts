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
  const result = db.exec(`
    SELECT e.*, c.name as category_name FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.project_id = '${projectId}'
    ORDER BY e.date DESC, e.created_at DESC
  `);
  return NextResponse.json(rowsToObjects(result));
}

export async function POST(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = await getDb();
  const id = uuid();
  db.run(`INSERT INTO expenses (id, project_id, category_id, description, amount, date, vendor, payment_method, notes, receipt_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, body.project_id, body.category_id || null, body.description, body.amount,
    body.date, body.vendor || '', body.payment_method || '', body.notes || '', body.receipt_path || ''
  ]);
  saveDb();
  return NextResponse.json({ id });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  const db = await getDb();
  db.run(`DELETE FROM expenses WHERE id = ?`, [id]);
  saveDb();
  return NextResponse.json({ success: true });
}
