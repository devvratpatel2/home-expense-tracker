/**
 * @OnlyCurrentDoc
 *
 * Lets the Build Ledger site keep this sheet in sync. Paste into Extensions -> Apps Script,
 * set a script property named SECRET, and deploy as a web app (Execute as: Me, Who has
 * access: Anyone). Requests without the matching secret are refused.
 */

const TAB_GID = 0;
const ID_COLUMN = 9; // Column I holds the site's id for each row.
const DATA_COLUMNS = 8; // Date, Amount, Description, Category, Vendor, Source, Notes, Allocations

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ error: 'Bad request' });
  }
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret || body.secret !== secret) return reply({ error: 'Not allowed' });

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const sheet = getSheet();
    prepareIdColumn(sheet);
    if (body.action === 'read') return reply({ rows: readRows(sheet, body.assignIds === true) });
    if (body.action === 'setIds') return reply(setIds(sheet, body.ids || []));
    if (body.action === 'upsert') return reply(upsert(sheet, body.row));
    if (body.action === 'delete') return reply(remove(sheet, body.id));
    if (body.action === 'renameCategory') return reply(renameCategory(sheet, body.from, body.to));
    return reply({ error: 'Unknown action' });
  } catch (err) {
    return reply({ error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets().filter(s => s.getSheetId() === TAB_GID)[0] || ss.getSheets()[0];
}

function prepareIdColumn(sheet) {
  const header = sheet.getRange(1, ID_COLUMN);
  if (header.getValue() === 'ID') return;
  header.setValue('ID');
  sheet.getRange(1, ID_COLUMN, sheet.getMaxRows(), 1)
    .protect()
    .setDescription('Build Ledger row ids. Editing these breaks the sync for that row.')
    .setWarningOnly(true);
}

function isoDate(value) {
  if (value instanceof Date) return Utilities.formatDate(value, getSheet().getParent().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return String(value || '').trim();
}

function readRows(sheet, assignIds) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, ID_COLUMN).getValues();
  const rows = [];
  const seen = {};
  let assigned = false;
  values.forEach((v, i) => {
    if (v[0] === '' && v[1] === '' && v[2] === '') return;
    let id = String(v[ID_COLUMN - 1] || '').trim();
    // A row copied along with its id would otherwise share it with the original.
    if (assignIds && (!id || seen[id])) {
      id = Utilities.getUuid();
      v[ID_COLUMN - 1] = id;
      assigned = true;
    }
    seen[id] = true;
    rows.push({
      row: i + 2,
      id: id,
      date: isoDate(v[0]),
      amount: typeof v[1] === 'number' ? v[1] : Number(String(v[1]).replace(/[$,\s]/g, '')),
      description: String(v[2]).trim(),
      category: String(v[3]).trim(),
      vendor: String(v[4]).trim(),
      source: String(v[5]).trim(),
      notes: String(v[6]).trim(),
      allocations: String(v[7]).trim(),
    });
  });
  if (assigned) sheet.getRange(2, ID_COLUMN, values.length, 1).setValues(values.map(v => [v[ID_COLUMN - 1]]));
  return rows;
}

function findRow(sheet, id) {
  const last = sheet.getLastRow();
  if (!id || last < 2) return 0;
  const ids = sheet.getRange(2, ID_COLUMN, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === id) return i + 2;
  return 0;
}

// Only writes an id onto a row whose description still matches, in case the sheet moved
// between the site's read and this call.
function setIds(sheet, ids) {
  const last = sheet.getLastRow();
  if (last < 2) return { written: 0 };
  const range = sheet.getRange(2, 1, last - 1, ID_COLUMN);
  const values = range.getValues();
  let written = 0;
  ids.forEach(item => {
    const v = values[item.row - 2];
    if (!v || String(v[2]).trim() !== item.description || String(v[ID_COLUMN - 1]).trim()) return;
    v[ID_COLUMN - 1] = item.id;
    written++;
  });
  if (written) sheet.getRange(2, ID_COLUMN, values.length, 1).setValues(values.map(v => [v[ID_COLUMN - 1]]));
  return { written: written };
}

function toSheetDate(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Number(m[2]) + '/' + Number(m[3]) + '/' + m[1] : iso;
}

// Text from the site is never run as a formula.
function text(v) {
  const s = String(v || '');
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function upsert(sheet, row) {
  if (!row || !row.id) throw new Error('Missing row id');
  const values = [[
    toSheetDate(row.date), Number(row.amount), text(row.description), text(row.category),
    text(row.vendor), text(row.source), text(row.notes), text(row.allocations),
  ]];
  let r = findRow(sheet, row.id);
  const isNew = !r;
  if (isNew) {
    r = sheet.getLastRow() + 1;
    if (r > 2) sheet.getRange(r - 1, 1, 1, DATA_COLUMNS).copyTo(sheet.getRange(r, 1, 1, DATA_COLUMNS), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sheet.getRange(r, ID_COLUMN).setValue(row.id);
  }
  sheet.getRange(r, 1, 1, DATA_COLUMNS).setValues(values);
  return { row: r, created: isNew };
}

function remove(sheet, id) {
  const r = findRow(sheet, id);
  if (r) sheet.deleteRow(r);
  return { deleted: !!r };
}

function renameCategory(sheet, from, to) {
  const last = sheet.getLastRow();
  if (!from || last < 2) return { changed: 0 };
  const range = sheet.getRange(2, 4, last - 1, 1);
  const values = range.getValues();
  let changed = 0;
  values.forEach(v => {
    if (String(v[0]).trim().toLowerCase() === String(from).toLowerCase()) { v[0] = text(to); changed++; }
  });
  if (changed) range.setValues(values);
  return { changed: changed };
}
