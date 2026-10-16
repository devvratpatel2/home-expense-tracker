import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

// The only route that answers without a login. It returns just the expense list for the
// project the link belongs to: no receipts, notes, budget, sheet links or account details.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const notFound = () => NextResponse.json({ error: 'This link has expired or been turned off.' }, { status: 404, headers });
  if (!/^[A-Za-z0-9_-]{32}$/.test(params.token)) return notFound();

  await initDb();
  const db = getDb();
  const link = await db.execute({
    sql: `SELECT s.project_id, s.expires_at, p.name FROM share_links s JOIN projects p ON p.id = s.project_id WHERE s.token = ?`,
    args: [params.token],
  });
  const row = link.rows[0];
  if (!row || (row.expires_at && new Date(row.expires_at as string) < new Date())) return notFound();

  await db.execute({ sql: `UPDATE share_links SET last_opened_at = datetime('now') WHERE token = ?`, args: [params.token] });

  const expenses = await db.execute({
    sql: `SELECT e.date, e.description, e.amount, e.vendor, e.paid_by, c.name AS category
      FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
      WHERE e.project_id = ? ORDER BY e.date DESC, e.created_at DESC`,
    args: [row.project_id],
  });

  return NextResponse.json({
    projectName: row.name,
    expiresAt: row.expires_at ?? null,
    expenses: expenses.rows.map((e, i) => ({
      id: i,
      date: e.date,
      description: e.description,
      amount: Number(e.amount) || 0,
      vendor: e.vendor || '',
      paid_by: e.paid_by === 'Owner' || e.paid_by === 'Builder' ? e.paid_by : '',
      category: e.category || '',
    })),
  }, { headers });
}
