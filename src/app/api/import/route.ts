import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { v4 as uuid } from 'uuid';
import { parse } from 'csv-parse/sync';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const projectId = formData.get('projectId') as string;
  if (!file || !projectId) return NextResponse.json({ error: 'File and projectId required' }, { status: 400 });

  const text = await file.text();
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });

  const db = await getDb();
  let imported = 0;

  for (const row of records as Record<string, string>[]) {
    const description = row.description || row.Description || row.item || row.Item || row.name || row.Name || '';
    const amount = parseFloat(row.amount || row.Amount || row.cost || row.Cost || row.total || row.Total || '0');
    const date = row.date || row.Date || new Date().toISOString().split('T')[0];
    const vendor = row.vendor || row.Vendor || row.supplier || row.Supplier || '';
    const category = row.category || row.Category || '';
    const notes = row.notes || row.Notes || '';

    if (!description || !amount) continue;

    // Try to match category
    let categoryId = null;
    if (category) {
      const catResult = db.exec(`SELECT id FROM categories WHERE project_id = '${projectId}' AND name LIKE '%${category.replace(/'/g, "''")}%' LIMIT 1`);
      if (catResult.length && catResult[0].values.length) {
        categoryId = catResult[0].values[0][0];
      }
    }

    db.run(`INSERT INTO expenses (id, project_id, category_id, description, amount, date, vendor, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [uuid(), projectId, categoryId, description, amount, date, vendor, notes]);
    imported++;
  }

  saveDb();
  return NextResponse.json({ imported });
}
