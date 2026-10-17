import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { canViewProject, getUserId } from '@/lib/auth';
import { findIssues } from '@/lib/insights';
import { maybePull } from '@/lib/sheet-sync';

type Payer = 'Owner' | 'Builder' | 'Unassigned';

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!(await canViewProject(userId, projectId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await maybePull(projectId!);

  const db = getDb();
  const project = await db.execute({ sql: `SELECT name, budget FROM projects WHERE id = ?`, args: [projectId] });
  const budget = Number(project.rows[0]?.budget ?? 0);

  const categories = await db.execute({ sql: `SELECT id, name, budget FROM categories WHERE project_id = ?`, args: [projectId] });
  const expenses = await db.execute({
    sql: `SELECT e.id, e.description, e.amount, e.date, e.vendor, e.paid_by, e.notes, e.allocations, e.excluded, c.name as category_name
      FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.project_id = ? ORDER BY e.date, e.created_at`,
    args: [projectId],
  });
  const left = expenses.rows.filter(r => r.excluded === 1);
  const excluded = { count: left.length, total: left.reduce((s, r) => s + (Number(r.amount) || 0), 0) };
  const rows = expenses.rows.filter(r => r.excluded !== 1).map(r => ({
    id: r.id as string,
    description: (r.description as string) || '',
    amount: Number(r.amount) || 0,
    date: (r.date as string) || '',
    vendor: (r.vendor as string) || '',
    notes: (r.notes as string) || '',
    payer: (r.paid_by === 'Owner' || r.paid_by === 'Builder' ? r.paid_by : 'Unassigned') as Payer,
    category_name: (r.category_name as string) || '',
    allocations: parseAllocations(r.allocations as string | null),
  }));

  const totalSpent = rows.reduce((s, r) => s + r.amount, 0);
  const byPaidBy = { Owner: 0, Builder: 0, Unassigned: 0 };
  for (const r of rows) byPaidBy[r.payer] += r.amount;

  // A payment split across categories counts toward each one by its allocation.
  const catTotals = new Map<string, { total: number; Owner: number; Builder: number; count: number }>();
  const addTo = (name: string, amount: number, payer: Payer) => {
    const c = catTotals.get(name) || { total: 0, Owner: 0, Builder: 0, count: 0 };
    c.total += amount;
    if (payer !== 'Unassigned') c[payer] += amount;
    c.count++;
    catTotals.set(name, c);
  };
  for (const r of rows) {
    if (r.allocations) for (const [name, amount] of Object.entries(r.allocations)) addTo(name, amount, r.payer);
    else addTo(r.category_name || 'Uncategorized', r.amount, r.payer);
  }
  const catBudgets = new Map(categories.rows.map(c => [c.name as string, Number(c.budget) || 0]));
  const byCategory = Array.from(catTotals, ([name, t]) => ({ name, total: t.total, owner: t.Owner, builder: t.Builder, count: t.count, budget: catBudgets.get(name) || 0 }))
    .sort((a, b) => b.total - a.total);
  for (const [name, b] of Array.from(catBudgets)) {
    if (b > 0 && !catTotals.has(name)) byCategory.push({ name, total: 0, owner: 0, builder: 0, count: 0, budget: b });
  }

  // From build-tracker: for categories the owner bought into, how the total compares with the
  // builder's quote for that line.
  const ownerSavings = byCategory
    .filter(c => c.budget > 0 && c.owner > 0)
    .map(c => ({ name: c.name, budget: c.budget, spent: c.total, saved: c.budget - c.total }))
    .sort((a, b) => b.saved - a.saved);

  // Spend that falls under a quote line vs everything the quote doesn't cover (financing, design, taxes...).
  const quoted = byCategory.filter(c => c.budget > 0);
  const quote = {
    lines: quoted.length,
    spent: quoted.reduce((s, c) => s + c.total, 0),
    overLines: quoted.filter(c => c.total > c.budget).length,
    outside: byCategory.filter(c => !(c.budget > 0) && c.total > 0).map(c => ({ name: c.name, total: c.total })),
  };

  const months = new Map<string, { month: string; Owner: number; Builder: number; Unassigned: number }>();
  for (const r of rows) {
    const month = r.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (!months.has(month)) months.set(month, { month, Owner: 0, Builder: 0, Unassigned: 0 });
    months.get(month)![r.payer] += r.amount;
  }
  let running = 0;
  const monthly = Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)).map(m => {
    running += m.Owner + m.Builder + m.Unassigned;
    return { ...m, cumulative: running };
  });

  const vendorTotals = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const v = r.vendor.trim() || '(no vendor)';
    const t = vendorTotals.get(v) || { total: 0, count: 0 };
    t.total += r.amount;
    t.count++;
    vendorTotals.set(v, t);
  }
  const topVendors = Array.from(vendorTotals, ([name, t]) => ({ name, ...t })).sort((a, b) => b.total - a.total).slice(0, 8);

  const recentExpenses = rows.slice(-6).reverse().map(r => ({
    id: r.id, description: r.description, amount: r.amount, date: r.date, category_name: r.category_name, paid_by: r.payer === 'Unassigned' ? '' : r.payer,
  }));

  return NextResponse.json({
    projectName: project.rows[0]?.name ?? '',
    totalSpent,
    budget,
    expenseCount: rows.length,
    excluded,
    remaining: budget - totalSpent,
    firstDate: rows[0]?.date ?? '',
    lastDate: rows[rows.length - 1]?.date ?? '',
    byPaidBy,
    byCategory,
    ownerSavings,
    quote,
    monthly,
    topVendors,
    recentExpenses,
    missing: {
      category: rows.filter(r => !r.category_name && !r.allocations).length,
      vendor: rows.filter(r => !r.vendor).length,
      paidBy: rows.filter(r => r.payer === 'Unassigned').length,
    },
    issues: findIssues(rows),
  });
}

function parseAllocations(raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && Object.keys(parsed).length ? parsed : null;
  } catch {
    return null;
  }
}

// Google Sheets calls can take a few seconds each.
export const maxDuration = 60;
