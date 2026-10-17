import { NextRequest, NextResponse } from 'next/server';
import { getDb, toIsoDate } from '@/lib/db';
import { canViewProject, getUserId, ownsProject, projectOf } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import { maybePull, pushDelete, pushExpense, SheetSyncError } from '@/lib/sheet-sync';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });
const sheetFailed = (e: unknown) => {
  if (e instanceof SheetSyncError) return NextResponse.json({ error: e.message }, { status: 502 });
  throw e;
};

function cleanFields(body: Record<string, unknown>) {
  return {
    category_id: (body.category_id as string) || null,
    description: String(body.description || '').trim(),
    amount: Number(body.amount),
    date: toIsoDate(String(body.date || '')),
    vendor: String(body.vendor || '').trim(),
    payment_method: String(body.payment_method || ''),
    paid_by: String(body.paid_by || ''),
    notes: String(body.notes || ''),
    receipt_path: String(body.receipt_path || ''),
  };
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!(await canViewProject(userId, projectId))) return notFound();
  await maybePull(projectId!);

  const result = await getDb().execute({
    sql: `SELECT e.*, c.name as category_name FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.project_id = ? ORDER BY e.date DESC, e.created_at DESC`,
    args: [projectId],
  });
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  if (!(await ownsProject(userId, body.project_id))) return notFound();

  const f = cleanFields(body);
  if (!f.description || !Number.isFinite(f.amount) || !f.date) return NextResponse.json({ error: 'Description, amount and a valid date are required' }, { status: 400 });

  const id = uuid();
  try {
    await pushExpense(body.project_id, id, f);
  } catch (e) {
    return sheetFailed(e);
  }
  await getDb().execute({
    sql: `INSERT INTO expenses (id, project_id, category_id, description, amount, date, vendor, payment_method, paid_by, notes, receipt_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, body.project_id, f.category_id, f.description, f.amount, f.date, f.vendor, f.payment_method, f.paid_by, f.notes, f.receipt_path],
  });
  return NextResponse.json({ id });
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  const projectId = await projectOf('expenses', body.id);
  if (!(await ownsProject(userId, projectId))) return notFound();

  const f = cleanFields(body);
  if (!f.description || !Number.isFinite(f.amount) || !f.date) return NextResponse.json({ error: 'Description, amount and a valid date are required' }, { status: 400 });

  const current = await getDb().execute({ sql: `SELECT allocations FROM expenses WHERE id = ?`, args: [body.id] });
  try {
    await pushExpense(projectId!, body.id, { ...f, allocations: current.rows[0]?.allocations as string | null });
  } catch (e) {
    return sheetFailed(e);
  }
  await getDb().execute({
    sql: `UPDATE expenses SET category_id = ?, description = ?, amount = ?, date = ?, vendor = ?,
      payment_method = ?, paid_by = ?, notes = ?, receipt_path = ? WHERE id = ?`,
    args: [f.category_id, f.description, f.amount, f.date, f.vendor, f.payment_method, f.paid_by, f.notes, f.receipt_path, body.id],
  });
  return NextResponse.json({ success: true });
}

// Ticks a payment in or out of the totals. This lives only on the site, so the sheet isn't called.
export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = await req.json();
  const projectId = await projectOf('expenses', body.id);
  if (!(await ownsProject(userId, projectId))) return notFound();
  if (typeof body.excluded !== 'boolean') return NextResponse.json({ error: 'excluded must be true or false' }, { status: 400 });

  await getDb().execute({ sql: `UPDATE expenses SET excluded = ? WHERE id = ?`, args: [body.excluded ? 1 : 0, body.id] });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const id = req.nextUrl.searchParams.get('id');
  const projectId = await projectOf('expenses', id);
  if (!(await ownsProject(userId, projectId))) return notFound();

  try {
    await pushDelete(projectId!, id!);
  } catch (e) {
    return sheetFailed(e);
  }
  await getDb().execute({ sql: `DELETE FROM expenses WHERE id = ?`, args: [id] });
  return NextResponse.json({ success: true });
}

// Google Sheets calls can take a few seconds each.
export const maxDuration = 60;
