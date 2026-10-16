import { NextRequest, NextResponse } from 'next/server';
import { getDb, toIsoDate } from '@/lib/db';
import { getUserId, ownsProject } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import { parse } from 'csv-parse/sync';

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const projectId = formData.get('projectId') as string;
  if (!file || !projectId) return NextResponse.json({ error: 'File and projectId required' }, { status: 400 });
  if (!(await ownsProject(userId, projectId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let records: Record<string, string>[];
  try {
    records = parse(await file.text(), { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown parse error';
    return NextResponse.json({ error: `CSV parse failed: ${msg}` }, { status: 400 });
  }

  if (!records.length) return NextResponse.json({ error: 'No data rows found in CSV' }, { status: 400 });

  const db = getDb();

  // Find a column value by trying multiple possible header names, ignoring case and punctuation.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const col = (row: Record<string, string>, ...keys: string[]) => {
    for (const k of keys) {
      const match = Object.keys(row).find(h => norm(h) === norm(k));
      if (match && row[match]) return row[match].trim();
    }
    return '';
  };
  const parseMoney = (v: string) => parseFloat(v.replace(/[$,]/g, '')) || 0;

  const cats = await db.execute({ sql: `SELECT id, name FROM categories WHERE project_id = ?`, args: [projectId] });
  const categoryIds = new Map(cats.rows.map(c => [(c.name as string).toLowerCase(), c.id as string]));

  // Count what is already in the project so re-importing the same sheet does not double everything.
  // Two identical rows in the sheet still import as two rows.
  const existing = await db.execute({ sql: `SELECT date, amount, description FROM expenses WHERE project_id = ?`, args: [projectId] });
  const keyOf = (date: string, amount: number, description: string) => `${date}|${amount.toFixed(2)}|${description.toLowerCase()}`;
  const alreadyThere = new Map<string, number>();
  for (const r of existing.rows) {
    const k = keyOf(r.date as string, Number(r.amount), r.description as string);
    alreadyThere.set(k, (alreadyThere.get(k) || 0) + 1);
  }
  const seenInFile = new Map<string, number>();

  let imported = 0;
  let skipped = 0;
  const createdCategories: string[] = [];

  for (const row of records) {
    const description = col(row, 'description', 'item', 'name');
    const amount = parseMoney(col(row, 'amount', 'cost', 'total'));
    if (!description || !amount) continue;

    const date = toIsoDate(col(row, 'date'));
    const k = keyOf(date, amount, description);
    seenInFile.set(k, (seenInFile.get(k) || 0) + 1);
    if (seenInFile.get(k)! <= (alreadyThere.get(k) || 0)) { skipped++; continue; }

    let categoryId: string | null = null;
    const category = col(row, 'category');
    if (category) {
      categoryId = categoryIds.get(category.toLowerCase()) || null;
      if (!categoryId) {
        categoryId = uuid();
        await db.execute({ sql: `INSERT INTO categories (id, project_id, name) VALUES (?, ?, ?)`, args: [categoryId, projectId, category] });
        categoryIds.set(category.toLowerCase(), categoryId);
        createdCategories.push(category);
      }
    }

    const source = col(row, 'source', 'paidby', 'paid by');
    const paidBy = /builder/i.test(source) ? 'Builder' : /owner/i.test(source) ? 'Owner' : '';

    await db.execute({
      sql: `INSERT INTO expenses (id, project_id, category_id, description, amount, date, vendor, payment_method, paid_by, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [uuid(), projectId, categoryId, description, amount, date, col(row, 'vendor', 'supplier'),
        col(row, 'payment method', 'paymentmethod', 'method'), paidBy, col(row, 'notes')],
    });
    imported++;
  }

  return NextResponse.json({ imported, skipped, createdCategories });
}
