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

  for (const row of records) {
    const description = row.description || row.Description || row.item || row.Item || row.name || row.Name || '';
    const amount = parseFloat(row.amount || row.Amount || row.cost || row.Cost || row.total || row.Total || '0');
    const date = row.date || row.Date || new Date().toISOString().split('T')[0];
    const vendor = row.vendor || row.Vendor || row.supplier || row.Supplier || '';
    const category = row.category || row.Category || '';
    const notes = row.notes || row.Notes || '';

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
