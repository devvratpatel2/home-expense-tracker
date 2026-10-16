// Flags rows worth a second look. Nothing is changed automatically; the user fixes them in the app.

export interface IssueRow {
  id: string;
  date: string;
  amount: number;
  description: string;
  vendor: string;
  notes: string;
}

export interface Issue {
  kind: 'duplicate' | 'refund' | 'vendor-spelling' | 'future-date';
  title: string;
  detail: string;
  search: string;
  amount: number;
}

const REFUND_WORDS = /\b(bounced?|refund(ed)?|returned|reversed|void(ed)?|chargeback|cancel(led|ed)?)\b/i;

export function findIssues(rows: IssueRow[], today = new Date().toISOString().slice(0, 10)): Issue[] {
  const issues: Issue[] = [];

  const groups = new Map<string, IssueRow[]>();
  for (const r of rows) {
    const k = `${r.date}|${r.amount.toFixed(2)}|${r.description.trim().toLowerCase()}`;
    groups.set(k, [...(groups.get(k) || []), r]);
  }
  for (const g of Array.from(groups.values())) {
    if (g.length < 2) continue;
    issues.push({
      kind: 'duplicate',
      title: `${g.length}× the same entry`,
      detail: `${g[0].description} on ${g[0].date}`,
      search: g[0].description,
      amount: g[0].amount * (g.length - 1),
    });
  }

  for (const r of rows) {
    if (REFUND_WORDS.test(`${r.description} ${r.notes}`)) {
      issues.push({ kind: 'refund', title: 'Counted as spent', detail: `${r.description} looks like a bounced or refunded payment`, search: r.description, amount: r.amount });
    }
    if (r.date > today) {
      issues.push({ kind: 'future-date', title: 'Dated in the future', detail: `${r.description} is dated ${r.date}`, search: r.description, amount: r.amount });
    }
  }

  const vendors = Array.from(new Set(rows.map(r => r.vendor.trim()).filter(Boolean)));
  const key = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '');
  const seen = new Set<string>();
  for (let i = 0; i < vendors.length; i++) {
    for (let j = i + 1; j < vendors.length; j++) {
      const a = key(vendors[i]);
      const b = key(vendors[j]);
      if (a === b || a.length < 4 || b.length < 4) continue;
      const shorter = a.length < b.length ? a : b;
      const longer = a.length < b.length ? b : a;
      const similar = longer.startsWith(shorter) || (Math.abs(a.length - b.length) <= 1 && editDistance(a, b) <= 1);
      if (!similar) continue;
      const pair = [vendors[i], vendors[j]].sort().join(' / ');
      if (seen.has(pair)) continue;
      seen.add(pair);
      issues.push({ kind: 'vendor-spelling', title: 'Vendor spelled two ways', detail: pair, search: vendors[i], amount: 0 });
    }
  }

  return issues;
}

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}
