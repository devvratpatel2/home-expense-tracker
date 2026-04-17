import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { v4 as uuid } from 'uuid';
import { parse } from 'csv-parse/sync';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const projectId = formData.get('projectId') as string;
  if (!file || !projectId) return NextResponse.json({ error: 'File and projectId required' }, { status: 400 });

  let records: Record<string, string>[];
  try {
    const raw = await file.text();
    const text = stripBom(raw);
    records = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown parse error';
    return NextResponse.json({ error: `CSV parse failed: ${msg}` }, { status: 400 });
  }

  if (!records.length) return NextResponse.json({ error: 'No data rows found in CSV' }, { status: 400 });

  await initDb();
  const db = getDb();
  let imported = 0;

  // Helper to find a column value by trying multiple possible header names
  const col = (row: Record<string, string>, ...keys: string[]) => {
    for (const k of keys) {
      const match = Object.keys(row).find(h => h.toLowerCase().replace(/[^a-z]/g, '') === k.toLowerCase().replace(/[^a-z]/g, ''));
      if (match && row[match]) return row[match].trim();
    }
    return '';
  };

  const parseMoney = (v: string) => parseFloat(v.replace(/[$,]/g, '')) || 0;

  for (const row of records) {
    const description = col(row, 'description', 'item', 'name');
    const amount = parseMoney(col(row, 'amount', 'amount$', 'cost', 'total'));
    const date = col(row, 'date') || new Date().toISOString().split('T')[0];
    const vendor = col(row, 'vendor', 'supplier');
    const category = col(row, 'category');
    const notes = col(row, 'notes');

    if (!description || !amount) continue;

    let categoryId: string | null = null;
    if (category) {
      const catResult = await db.execute({
        sql: `SELECT id FROM categories WHERE project_id = ? AND name LIKE ? LIMIT 1`,
        args: [projectId, `%${category}%`],
      });
      if (catResult.rows.length) categoryId = catResult.rows[0].id as string;
    }

    await db.execute({
      sql: `INSERT INTO expenses (id, project_id, category_id, description, amount, date, vendor, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [uuid(), projectId, categoryId, description, amount, date, vendor, notes],
    });
    imported++;
  }

  return NextResponse.json({ imported });
}
