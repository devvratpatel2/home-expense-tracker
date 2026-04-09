import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

function rowsToObjects(result: { columns: string[]; values: unknown[][] }[]) {
  if (!result.length) return [];
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    result[0].columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
}

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const db = await getDb();

  // Total spent
  const totalResult = db.exec(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE project_id = '${projectId}'`);
  const totalSpent = totalResult.length ? totalResult[0].values[0][0] : 0;

  // Budget
  const budgetResult = db.exec(`SELECT budget FROM projects WHERE id = '${projectId}'`);
  const budget = budgetResult.length ? budgetResult[0].values[0][0] : 0;

  // Expense count
  const countResult = db.exec(`SELECT COUNT(*) FROM expenses WHERE project_id = '${projectId}'`);
  const expenseCount = countResult.length ? countResult[0].values[0][0] : 0;

  // By category
  const byCat = db.exec(`
    SELECT c.name, COALESCE(SUM(e.amount), 0) as total
    FROM categories c LEFT JOIN expenses e ON c.id = e.category_id
    WHERE c.project_id = '${projectId}'
    GROUP BY c.id, c.name HAVING total > 0 ORDER BY total DESC
  `);

  // Monthly spending
  const monthly = db.exec(`
    SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
    FROM expenses WHERE project_id = '${projectId}'
    GROUP BY month ORDER BY month
  `);

  // Recent expenses
  const recent = db.exec(`
    SELECT e.*, c.name as category_name FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.project_id = '${projectId}'
    ORDER BY e.date DESC LIMIT 5
  `);

  return NextResponse.json({
    totalSpent,
    budget,
    expenseCount,
    remaining: (budget as number) - (totalSpent as number),
    byCategory: rowsToObjects(byCat),
    monthly: rowsToObjects(monthly),
    recentExpenses: rowsToObjects(recent),
  });
}
