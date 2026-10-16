import type { InStatement } from '@libsql/client';
import { v4 as uuid } from 'uuid';
import { getDb, toIsoDate } from '@/lib/db';

// Two-way sync with the owner's Google Sheet through the Apps Script web app in
// apps-script/Code.gs. Site edits are written to the sheet before they're saved here, and the
// sheet is pulled back in when the site is viewed, so edits made in Sheets show up too.

export class SheetSyncError extends Error {}

const PULL_EVERY_MS = 30_000;
const WEB_APP_URL = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/;
const ID = /^[A-Za-z0-9-]{8,64}$/;

interface Config { url: string; secret: string }
interface SheetRow {
  row: number; id: string; date: string; amount: number; description: string;
  category: string; vendor: string; source: string; notes: string; allocations: string;
}
export interface ExpenseFields {
  date: string; amount: number; description: string; category_id: string | null;
  vendor: string; paid_by: string; notes: string; allocations?: string | null;
}

export const isWebAppUrl = (url: string) => WEB_APP_URL.test(url);

async function call<T>(cfg: Config, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: cfg.secret, action, ...payload }),
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new SheetSyncError('Couldn’t reach Google Sheets. Nothing was saved. Try again in a minute.');
  }
  const text = await res.text();
  let data: { error?: string } & T;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SheetSyncError('Google Sheets didn’t answer properly. Check the web app is deployed with access set to “Anyone”.');
  }
  if (data.error) throw new SheetSyncError(data.error === 'Not allowed' ? 'The sheet refused the secret. Check it matches the SECRET script property.' : `Google Sheets: ${data.error}`);
  return data;
}

export async function syncConfig(projectId: string): Promise<Config | null> {
  const r = await getDb().execute({ sql: `SELECT sheet_sync_url, sheet_sync_secret FROM projects WHERE id = ?`, args: [projectId] });
  const row = r.rows[0];
  return row?.sheet_sync_url && row?.sheet_sync_secret ? { url: row.sheet_sync_url as string, secret: row.sheet_sync_secret as string } : null;
}

async function categoryName(categoryId: string | null) {
  if (!categoryId) return '';
  const r = await getDb().execute({ sql: `SELECT name FROM categories WHERE id = ?`, args: [categoryId] });
  return (r.rows[0]?.name as string) || '';
}

// Writes one expense to the sheet. Throws if the sheet can't be updated, so the caller can
// refuse the save and keep the two in step.
export async function pushExpense(projectId: string, id: string, f: ExpenseFields) {
  const cfg = await syncConfig(projectId);
  if (!cfg) return;
  await call(cfg, 'upsert', {
    row: {
      id, date: f.date, amount: f.amount, description: f.description, category: await categoryName(f.category_id),
      vendor: f.vendor, source: f.paid_by, notes: f.notes, allocations: f.allocations || '',
    },
  });
}

export async function pushDelete(projectId: string, id: string) {
  const cfg = await syncConfig(projectId);
  if (cfg) await call(cfg, 'delete', { id });
}

export async function pushCategoryRename(projectId: string, from: string, to: string) {
  const cfg = await syncConfig(projectId);
  if (cfg && from && from !== to) await call(cfg, 'renameCategory', { from, to });
}

const keyOf = (date: string, amount: number, description: string) => `${date}|${Number(amount).toFixed(2)}|${description.trim().toLowerCase()}`;

// First connection: the sheet's rows have no ids yet, so each is matched to the site's copy by
// date, amount and description and given that row's id. Site rows the sheet doesn't have are
// added to it, and sheet rows the site doesn't have come in on the pull that follows.
export async function connectSheet(projectId: string, url: string, secret: string) {
  if (!isWebAppUrl(url)) throw new SheetSyncError('Paste the web app URL from Apps Script. It looks like https://script.google.com/macros/s/…/exec');
  if (secret.length < 16) throw new SheetSyncError('The secret needs at least 16 characters.');
  const cfg = { url, secret };

  const { rows } = await call<{ rows: SheetRow[] }>(cfg, 'read', { assignIds: false });
  const db = getDb();
  const site = await db.execute({
    sql: `SELECT e.id, e.date, e.amount, e.description, e.category_id, e.vendor, e.paid_by, e.notes, e.allocations
      FROM expenses e WHERE e.project_id = ?`,
    args: [projectId],
  });

  const sheetIds = new Set(rows.map(r => r.id).filter(Boolean));
  const unmatched = new Map<string, typeof site.rows>();
  for (const r of site.rows) {
    if (sheetIds.has(r.id as string)) continue;
    const k = keyOf(r.date as string, Number(r.amount), r.description as string);
    unmatched.set(k, [...(unmatched.get(k) || []), r]);
  }

  const ids: { row: number; id: string; description: string }[] = [];
  for (const r of rows) {
    if (r.id) continue;
    const match = unmatched.get(keyOf(toIsoDate(r.date), r.amount, r.description))?.shift();
    if (match) ids.push({ row: r.row, id: match.id as string, description: r.description });
  }
  const { written } = ids.length ? await call<{ written: number }>(cfg, 'setIds', { ids }) : { written: 0 };

  const siteOnly = Array.from(unmatched.values()).flat();
  for (const r of siteOnly) {
    await call(cfg, 'upsert', {
      row: {
        id: r.id, date: r.date, amount: Number(r.amount), description: r.description, category: await categoryName(r.category_id as string | null),
        vendor: r.vendor || '', source: r.paid_by || '', notes: r.notes || '', allocations: r.allocations || '',
      },
    });
  }

  await db.execute({
    sql: `UPDATE projects SET sheet_sync_url = ?, sheet_sync_secret = ?, sheet_pulled_at = NULL, sheet_sync_error = NULL WHERE id = ?`,
    args: [url, secret, projectId],
  });
  const pulled = await pullFromSheet(projectId, true);
  return { matched: written, addedToSheet: siteOnly.length, ...pulled };
}

export async function disconnectSheet(projectId: string) {
  await getDb().execute({
    sql: `UPDATE projects SET sheet_sync_url = NULL, sheet_sync_secret = NULL, sheet_pulled_at = NULL, sheet_sync_error = NULL WHERE id = ?`,
    args: [projectId],
  });
}

// Called from the read routes. Pulls at most every 30 seconds per project, and never lets a
// sheet problem stop the page from loading: the error is saved for the Import page instead.
export async function maybePull(projectId: string) {
  try {
    await pullFromSheet(projectId, false);
  } catch {
    // Recorded in sheet_sync_error by pullFromSheet.
  }
}

export async function pullFromSheet(projectId: string, force: boolean) {
  const cfg = await syncConfig(projectId);
  if (!cfg) return { added: 0, updated: 0, removed: 0 };

  const db = getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - PULL_EVERY_MS).toISOString();
  const claim = await db.execute({
    sql: `UPDATE projects SET sheet_pulled_at = ? WHERE id = ? AND (? OR sheet_pulled_at IS NULL OR sheet_pulled_at < ?)`,
    args: [now.toISOString(), projectId, force ? 1 : 0, cutoff],
  });
  if (!claim.rowsAffected) return { added: 0, updated: 0, removed: 0 };

  try {
    const result = await applyPull(projectId, (await call<{ rows: SheetRow[] }>(cfg, 'read', { assignIds: true })).rows);
    await db.execute({ sql: `UPDATE projects SET sheet_sync_error = ? WHERE id = ?`, args: [result.warning, projectId] });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed';
    await db.execute({ sql: `UPDATE projects SET sheet_sync_error = ? WHERE id = ?`, args: [message, projectId] });
    throw e;
  }
}

async function applyPull(projectId: string, rows: SheetRow[]) {
  if (!rows.length) throw new SheetSyncError('The sheet came back empty, so nothing was changed here.');

  const db = getDb();
  const cats = await db.execute({ sql: `SELECT id, name FROM categories WHERE project_id = ?`, args: [projectId] });
  const categoryIds = new Map(cats.rows.map(c => [(c.name as string).toLowerCase(), c.id as string]));
  const site = await db.execute({
    sql: `SELECT id, date, amount, description, category_id, vendor, paid_by, notes, allocations FROM expenses WHERE project_id = ?`,
    args: [projectId],
  });
  const siteById = new Map(site.rows.map(r => [r.id as string, r]));

  const statements: InStatement[] = [];
  const seen = new Set<string>();
  let added = 0, updated = 0, unreadable = 0;

  for (const r of rows) {
    const date = toIsoDate(r.date);
    if (!ID.test(r.id) || !r.description || !Number.isFinite(r.amount) || !date) { unreadable++; continue; }
    seen.add(r.id);

    let categoryId: string | null = null;
    if (r.category) {
      categoryId = categoryIds.get(r.category.toLowerCase()) || null;
      if (!categoryId) {
        categoryId = uuid();
        categoryIds.set(r.category.toLowerCase(), categoryId);
        statements.push({ sql: `INSERT INTO categories (id, project_id, name) VALUES (?, ?, ?)`, args: [categoryId, projectId, r.category] });
      }
    }
    const paidBy = /builder/i.test(r.source) ? 'Builder' : /owner/i.test(r.source) ? 'Owner' : '';
    const allocations = r.allocations || null;
    const next = [date, r.amount, r.description, categoryId, r.vendor, paidBy, r.notes, allocations];

    const current = siteById.get(r.id);
    if (!current) {
      statements.push({
        sql: `INSERT INTO expenses (id, project_id, date, amount, description, category_id, vendor, paid_by, notes, allocations)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
        args: [r.id, projectId, ...next],
      });
      added++;
      continue;
    }
    const before = [current.date, Number(current.amount), current.description, current.category_id ?? null,
      current.vendor || '', current.paid_by || '', current.notes || '', current.allocations || null];
    if (before.some((v, i) => v !== next[i])) {
      statements.push({
        sql: `UPDATE expenses SET date = ?, amount = ?, description = ?, category_id = ?, vendor = ?, paid_by = ?, notes = ?, allocations = ?
          WHERE id = ? AND project_id = ?`,
        args: [...next, r.id, projectId],
      });
      updated++;
    }
  }

  // Rows deleted in the sheet are deleted here too, unless it looks like far more than a normal
  // edit, which is more likely a sheet mistake than real deletes.
  const gone = site.rows.map(r => r.id as string).filter(id => !seen.has(id));
  let warning: string | null = unreadable ? `${unreadable} sheet rows were skipped because their date, amount or description couldn’t be read.` : null;
  let removed = 0;
  if (gone.length > 5 && gone.length > site.rows.length * 0.2) {
    warning = `${gone.length} payments are missing from the sheet. That’s more than a normal edit, so they were kept here. Delete them on the Expenses page if that’s intended.`;
  } else {
    for (const id of gone) statements.push({ sql: `DELETE FROM expenses WHERE id = ? AND project_id = ?`, args: [id, projectId] });
    removed = gone.length;
  }

  if (statements.length) await db.batch(statements, 'write');
  return { added, updated, removed, warning };
}
