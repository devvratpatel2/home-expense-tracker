export const money = (n: number, cents = false) =>
  `${n < 0 ? '−' : ''}$${Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;

export const shortMoney = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
};

export const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '0%');

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' }).replace(' ', " '");
};

export const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
