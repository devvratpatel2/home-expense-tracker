import { createClient, type Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';

let client: Client | null = null;
let ready: Promise<void> | null = null;

export function getDb(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL || 'file:data/tracker.db';
  if (url.startsWith('file:')) fs.mkdirSync(path.dirname(url.slice(5)), { recursive: true });

  client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return client;
}

// Runs the schema setup once per server instance instead of on every request.
export function initDb() {
  if (!ready) ready = setupSchema().catch(e => { ready = null; throw e; });
  return ready;
}

async function setupSchema() {
  const db = getDb();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      budget REAL DEFAULT 0,
      start_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      budget REAL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category_id TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      vendor TEXT,
      payment_method TEXT,
      paid_by TEXT,
      notes TEXT,
      receipt_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    CREATE TABLE IF NOT EXISTS progress_updates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      phase TEXT,
      status TEXT DEFAULT 'in_progress',
      image_path TEXT,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS files (
      key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content_type TEXT NOT NULL,
      data BLOB NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Databases created before paid_by existed need the column added.
  const cols = await db.execute(`PRAGMA table_info(expenses)`);
  if (!cols.rows.some(c => c.name === 'paid_by')) {
    await db.execute(`ALTER TABLE expenses ADD COLUMN paid_by TEXT`);
  }

  // Older imports stored sheet dates as M/D/YYYY, which breaks month grouping.
  const oldDates = await db.execute(`SELECT id, date FROM expenses WHERE date LIKE '%/%'`);
  for (const row of oldDates.rows) {
    await db.execute({ sql: `UPDATE expenses SET date = ? WHERE id = ?`, args: [toIsoDate(row.date as string), row.id] });
  }
}

// Accepts YYYY-MM-DD, M/D/YYYY or M/D/YY and returns YYYY-MM-DD.
export function toIsoDate(value: string): string {
  const v = (value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return new Date().toISOString().split('T')[0];
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}
