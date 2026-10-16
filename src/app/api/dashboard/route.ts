import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserId, ownsProject } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!(await ownsProject(userId, projectId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const db = getDb();
  const project = await db.execute({ sql: `SELECT budget FROM projects WHERE id = ?`, args: [projectId] });
  const budget = Number(project.rows[0]?.budget ?? 0);

  const categories = await db.execute({ sql: `SELECT id, name, budget FROM categories WHERE project_id = ?`, args: [projectId] });
  const expenses = await db.execute({
    sql: `SELECT e.id, e.description, e.amount, e.date, e.vendor, e.paid_by, e.category_id, c.name as category_name
      FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.project_id = ? ORDER BY e.date, e.created_at`,
    args: [projectId],
  });
  const rows = expenses.rows.map(r => ({
    id: r.id as string,
    description: r.description as string,
    amount: Number(r.amount),
    date: r.date as string,
    vendor: (r.vendor as string) || '',
    payer: (r.paid_by === 'Owner' || r.paid_by === 'Builder' ? r.paid_by : 'Unassigned') as 'Owner' | 'Builder' | 'Unassigned',
    category_name: (r.category_name as string) || '',
  }));

  const totalSpent = rows.reduce((s, r) => s + r.amount, 0);

  const byPaidBy = { Owner: 0, Builder: 0, Unassigned: 0 };
  for (const r of rows) byPaidBy[r.payer] += r.amount;

  const catTotals = new Map<string, number>();
  for (const r of rows) {
    const name = r.category_name || 'Uncategorized';
    catTotals.set(name, (catTotals.get(name) || 0) + r.amount);
  }
  const catBudgets = new Map(categories.rows.map(c => [c.name as string, Number(c.budget) || 0]));
  const byCategory = Array.from(catTotals, ([name, total]) => ({ name, total, budget: catBudgets.get(name) || 0 }))
    .sort((a, b) => b.total - a.total);

  // One bucket per month with Owner/Builder split plus a running total for the burn-up line.
  const months = new Map<string, { month: string; Owner: number; Builder: number; Unassigned: number }>();
  for (const r of rows) {
    const month = r.date.slice(0, 7);
    if (!months.has(month)) months.set(month, { month, Owner: 0, Builder: 0, Unassigned: 0 });
    months.get(month)![r.payer] += r.amount;
  }
  let running = 0;
  const monthly = Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)).map(m => {
    running += m.Owner + m.Builder + m.Unassigned;
    return { ...m, cumulative: running, budget: budget || null };
  });

  const vendorTotals = new Map<string, number>();
  for (const r of rows) {
    const v = r.vendor.trim() || '(no vendor)';
    vendorTotals.set(v, (vendorTotals.get(v) || 0) + r.amount);
  }
  const topVendors = Array.from(vendorTotals, ([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 8);

  const recentExpenses = rows.slice(-5).reverse().map(r => ({ ...r, paid_by: r.payer === 'Unassigned' ? '' : r.payer }));

  return NextResponse.json({
    totalSpent,
    budget,
    expenseCount: rows.length,
    remaining: budget - totalSpent,
    byPaidBy,
    byCategory,
    monthly,
    topVendors,
    recentExpenses,
  });
}
