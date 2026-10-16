import { NextRequest, NextResponse } from 'next/server';
import type { InStatement } from '@libsql/client';
import { getDb, toIsoDate } from '@/lib/db';
import { getUserId, ownsProject } from '@/lib/auth';
import { v4 as uuid } from 'uuid';
import { parse } from 'csv-parse/sync';
import { fetchSheetCsv, SheetAccessError } from '@/lib/sheet-link';
import { isBudgetHeaderRow, normalizeBudgetCategory } from '@/lib/smart/budget-names';

type Kind = 'expenses' | 'budget';

const parseMoney = (v: string) => parseFloat(String(v || '').replace(/[$,\s]/g, '')) || 0;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Imports either an uploaded CSV file or a Google Sheet link. The sheet is only ever read.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return fail('Unauthorized', 401);

  let text: string;
  let projectId: string;
  let kind: Kind;
  let sheetUrl = '';

  if (req.headers.get('content-type')?.includes('application/json')) {
    const body = await req.json();
    projectId = body.projectId;
    kind = body.kind === 'budget' ? 'budget' : 'expenses';
    sheetUrl = String(body.sheetUrl || '').trim();
    if (!(await ownsProject(userId, projectId))) return fail('Not found', 404);
    try {
      text = await fetchSheetCsv(sheetUrl);
    } catch (e) {
      return fail(e instanceof SheetAccessError ? e.message : 'Couldn’t reach Google Sheets. Try again in a minute.');
    }
  } else {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    projectId = formData.get('projectId') as string;
    kind = formData.get('kind') === 'budget' ? 'budget' : 'expenses';
    if (!file || !projectId) return fail('File and projectId required');
    if (!(await ownsProject(userId, projectId))) return fail('Not found', 404);
    text = await file.text();
  }

  try {
    const result = kind === 'budget' ? await importBudget(projectId, text) : await importExpenses(projectId, text);
    if (sheetUrl) {
      const column = kind === 'budget' ? 'budget_sheet_url' : 'sheet_url';
      await getDb().execute({ sql: `UPDATE projects SET ${column} = ? WHERE id = ?`, args: [sheetUrl, projectId] });
    }
    return NextResponse.json(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Import failed');
  }
}

function readCsv(text: string, columns: boolean): unknown[] {
  try {
    return parse(text, { columns, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true });
  } catch (e) {
    throw new Error(`CSV parse failed: ${e instanceof Error ? e.message : 'unknown error'}`);
  }
}

async function categoryMap(projectId: string) {
  const cats = await getDb().execute({ sql: `SELECT id, name FROM categories WHERE project_id = ?`, args: [projectId] });
  return new Map(cats.rows.map(c => [(c.name as string).toLowerCase(), c.id as string]));
}

async function importExpenses(projectId: string, text: string) {
  const records = readCsv(text, true) as Record<string, string>[];
  if (!records.length) throw new Error('No data rows found');

  const db = getDb();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const col = (row: Record<string, string>, ...keys: string[]) => {
    for (const k of keys) {
      const match = Object.keys(row).find(h => norm(h) === norm(k));
      if (match && row[match]) return row[match].trim();
    }
    return '';
  };

  const categoryIds = await categoryMap(projectId);
  const keyOf = (date: string, amount: number, description: string) => `${date}|${amount.toFixed(2)}|${description.toLowerCase()}`;

  // Rows already in the app are matched (not re-added). Two identical rows in the sheet still
  // match two rows in the app, so real repeat payments aren't lost.
  const existing = await db.execute({ sql: `SELECT id, date, amount, description, category_id, vendor, paid_by FROM expenses WHERE project_id = ?`, args: [projectId] });
  const existingByKey = new Map<string, typeof existing.rows>();
  for (const r of existing.rows) {
    const k = keyOf(r.date as string, Number(r.amount), r.description as string);
    existingByKey.set(k, [...(existingByKey.get(k) || []), r]);
  }

  const statements: InStatement[] = [];
  const createdCategories: string[] = [];
  let imported = 0, skipped = 0, filled = 0, badDates = 0;

  for (const row of records) {
    const description = col(row, 'description', 'item', 'name');
    const amount = parseMoney(col(row, 'amount', 'cost', 'total'));
    if (!description || !amount) continue;

    const date = toIsoDate(col(row, 'date'));
    if (!date) { badDates++; continue; }

    let categoryId: string | null = null;
    const category = col(row, 'category');
    if (category) {
      categoryId = categoryIds.get(category.toLowerCase()) || null;
      if (!categoryId) {
        categoryId = uuid();
        statements.push({ sql: `INSERT INTO categories (id, project_id, name) VALUES (?, ?, ?)`, args: [categoryId, projectId, category] });
        categoryIds.set(category.toLowerCase(), categoryId);
        createdCategories.push(category);
      }
    }

    const source = col(row, 'source', 'paid by');
    const paidBy = /builder/i.test(source) ? 'Builder' : /owner/i.test(source) ? 'Owner' : '';
    const vendor = col(row, 'vendor', 'supplier');
    const allocations = validAllocations(col(row, 'allocations'));

    const match = existingByKey.get(keyOf(date, amount, description))?.shift();
    if (match) {
      skipped++;
      // Fill in what an earlier import dropped, without overwriting anything set in the app.
      const fill = {
        category_id: !match.category_id && categoryId ? categoryId : null,
        vendor: !match.vendor && vendor ? vendor : null,
        paid_by: !match.paid_by && paidBy ? paidBy : null,
      };
      if (fill.category_id || fill.vendor || fill.paid_by) {
        filled++;
        statements.push({
          sql: `UPDATE expenses SET category_id = COALESCE(?, category_id), vendor = COALESCE(?, vendor), paid_by = COALESCE(?, paid_by) WHERE id = ?`,
          args: [fill.category_id, fill.vendor, fill.paid_by, match.id],
        });
      }
      continue;
    }

    statements.push({
      sql: `INSERT INTO expenses (id, project_id, category_id, description, amount, date, vendor, payment_method, paid_by, notes, allocations)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [uuid(), projectId, categoryId, description, amount, date, vendor,
        col(row, 'payment method', 'method'), paidBy, col(row, 'notes'), allocations],
    });
    imported++;
  }

  if (statements.length) await db.batch(statements, 'write');
  return { kind: 'expenses', imported, skipped, filled, badDates, createdCategories };
}

// The sheet's Allocations column holds JSON like {"Plumbing Rough In": 1200, "HVAC Rough In": 800}
// when one payment covers several categories.
function validAllocations(raw: string): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const clean = Object.fromEntries(Object.entries(parsed).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]));
    return Object.keys(clean).length ? JSON.stringify(clean) : null;
  } catch {
    return null;
  }
}

async function importBudget(projectId: string, text: string) {
  const rows = (readCsv(text, false) as string[][]).filter(r => r.length >= 2);
  const start = isBudgetHeaderRow(rows[0]) ? 1 : 0;

  const lines = new Map<string, number>();
  for (const [item, cost] of rows.slice(start)) {
    const name = String(item || '').trim();
    const amount = parseMoney(cost);
    if (!name || name.toLowerCase() === 'total' || amount <= 0) continue;
    const category = normalizeBudgetCategory(name);
    lines.set(category, (lines.get(category) || 0) + amount);
  }
  if (!lines.size) throw new Error('No budget lines found. The budget sheet needs an item name in column A and a cost in column B.');

  const categoryIds = await categoryMap(projectId);
  const statements: InStatement[] = [];
  const createdCategories: string[] = [];
  for (const [category, amount] of Array.from(lines)) {
    const id = categoryIds.get(category.toLowerCase());
    if (id) {
      statements.push({ sql: `UPDATE categories SET budget = ? WHERE id = ?`, args: [amount, id] });
    } else {
      statements.push({ sql: `INSERT INTO categories (id, project_id, name, budget) VALUES (?, ?, ?, ?)`, args: [uuid(), projectId, category, amount] });
      createdCategories.push(category);
    }
  }
  const total = Array.from(lines.values()).reduce((s, v) => s + v, 0);
  statements.push({ sql: `UPDATE projects SET budget = ? WHERE id = ?`, args: [total, projectId] });

  await getDb().batch(statements, 'write');
  return { kind: 'budget', budgetLines: lines.size, total, createdCategories };
}
