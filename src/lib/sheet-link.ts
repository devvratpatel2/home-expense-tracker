// Reads a Google Sheet through its public CSV export. Read-only: the app never writes to the sheet.
// Only docs.google.com is ever fetched, built from the parsed id, so a pasted URL can't point the
// server at anything else.

export class SheetAccessError extends Error {}

export function parseSheetLink(link: string): { id: string; gid: string } | null {
  const v = (link || '').trim();
  const id = v.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)?.[1] ?? (/^[a-zA-Z0-9_-]{30,}$/.test(v) ? v : null);
  if (!id) return null;
  const gid = v.match(/[#?&]gid=(\d+)/)?.[1] ?? '0';
  return { id, gid };
}

export async function fetchSheetCsv(link: string): Promise<string> {
  const parsed = parseSheetLink(link);
  if (!parsed) throw new SheetAccessError('That doesn’t look like a Google Sheets link.');

  const url = `https://docs.google.com/spreadsheets/d/${parsed.id}/export?format=csv&gid=${parsed.gid}`;
  const res = await fetch(url, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const type = res.headers.get('content-type') || '';

  if (res.status === 401 || res.status === 403 || type.includes('text/html')) {
    throw new SheetAccessError(
      'Google wouldn’t share this sheet. Set it to “Anyone with the link: Viewer” in Share, or download it as CSV and upload the file instead.',
    );
  }
  if (!res.ok) throw new SheetAccessError(`Google returned an error (${res.status}) for this sheet.`);
  return res.text();
}
