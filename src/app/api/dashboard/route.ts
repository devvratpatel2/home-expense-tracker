import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  await initDb();
  const db = getDb();

  const totalResult = await db.execute({ sql: `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE project_id = ?`, args: [projectId] });
  const totalSpent = totalResult.rows[0]?.total ?? 0;

  const budgetResult = await db.execute({ sql: `SELECT budget FROM projects WHERE id = ?`, args: [projectId] });
  const budget = budgetResult.rows[0]?.budget ?? 0;

  const countResult = await db.execute({ sql: `SELECT COUNT(*) as cnt FROM expenses WHERE project_id = ?`, args: [projectId] });
  const expenseCount = countResult.rows[0]?.cnt ?? 0;

  const byCat = await db.execute({
    sql: `SELECT c.name, COALESCE(SUM(e.amount), 0) as total
      FROM categories c LEFT JOIN expenses e ON c.id = e.category_id
      WHERE c.project_id = ? GROUP BY c.id, c.name HAVING total > 0 ORDER BY total DESC`,
    args: [projectId],
  });

  const monthly = await db.execute({
    sql: `SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
      FROM expenses WHERE project_id = ? GROUP BY month ORDER BY month`,
    args: [projectId],
  });

  const recent = await db.execute({
    sql: `SELECT e.*, c.name as category_name FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.project_id = ? ORDER BY e.date DESC LIMIT 5`,
    args: [projectId],
  });

  return NextResponse.json({
    totalSpent,
    budget,
    expenseCount,
    remaining: (budget as number) - (totalSpent as number),
    byCategory: byCat.rows,
    monthly: monthly.rows,
    recentExpenses: recent.rows,
  });
}
