'use client';
import { useEffect, useMemo, useState } from 'react';
import { money, longDate } from '@/lib/format';
import { at } from '@/lib/reveal';

interface Row { id: number; date: string; description: string; amount: number; vendor: string; paid_by: string; category: string; counted: boolean }
interface Shared { projectName: string; expiresAt: string | null; expenses: Row[] }
type SortKey = 'date' | 'description' | 'category' | 'vendor' | 'paid_by' | 'amount';

export default function SharedExpensesPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(params.token)}`)
      .then(async r => (r.ok ? setData(await r.json()) : setError((await r.json()).error || 'This link does not work.')))
      .catch(() => setError('Could not load the expenses.'));
  }, [params.token]);

  const categories = useMemo(() => Array.from(new Set((data?.expenses || []).map(e => e.category).filter(Boolean))).sort(), [data]);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    const rows = (data?.expenses || []).filter(e =>
      (!q || [e.description, e.vendor, e.category].some(v => v.toLowerCase().includes(q))) &&
      (!category || e.category === category) &&
      (!paidBy || e.paid_by === paidBy));
    return rows.sort((a, b) => {
      const x = sortKey === 'amount' ? a.amount - b.amount : String(a[sortKey]).localeCompare(String(b[sortKey]));
      return sortAsc ? x : -x;
    });
  }, [data, search, category, paidBy, sortKey, sortAsc]);

  if (error) {
    return (
      <main className="min-h-screen px-6 sm:px-12 lg:px-20 py-16">
        <p className="eyebrow">Build Ledger</p>
        <h1 className="font-display text-5xl lg:text-6xl leading-none mt-24 max-w-xl">{error}</h1>
        <p className="mt-6 text-ink-2">Ask whoever sent it for a new one.</p>
      </main>
    );
  }
  if (!data) return <main className="min-h-screen grid place-items-center"><p className="font-display italic text-2xl text-ink-3">Opening the ledger…</p></main>;

  const total = visible.reduce((s, e) => s + (e.counted ? e.amount : 0), 0);
  const leftOut = visible.filter(e => !e.counted).length;
  const sortBy = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key !== 'date' && key !== 'amount'); }
  };
  const header = (key: SortKey, label: string, right = false) => (
    <th className={right ? '!text-right' : ''} aria-sort={sortKey === key ? (sortAsc ? 'ascending' : 'descending') : undefined}>
      <button onClick={() => sortBy(key)} className={`hover:text-ink ${sortKey === key ? 'text-ink' : ''}`}>
        {label}{sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  return (
    <main className="min-h-screen px-5 sm:px-8 lg:px-20 py-10 lg:py-14 max-w-[1400px]">
      <header className="reveal grid lg:grid-cols-12 gap-6 items-end" style={at(0)}>
        <div className="lg:col-span-7">
          <p className="eyebrow">Build <span className="text-accent">Ledger</span> · {data.projectName}</p>
          <h1 className="font-display text-6xl lg:text-7xl leading-none mt-2">Expenses</h1>
          <p className="mt-3 text-sm text-ink-3">Shared with you to view. {data.expiresAt ? `This link works until ${longDate(data.expiresAt.slice(0, 10))}.` : ''}</p>
        </div>
        <p className="lg:col-span-5 lg:text-right lg:pb-2">
          <span className="num font-display text-5xl">{money(total)}</span>
          <span className="block text-sm text-ink-3">{visible.length}{visible.length !== data.expenses.length ? ` of ${data.expenses.length}` : ''} payments{leftOut > 0 && `, ${leftOut} not counted`}</span>
        </p>
      </header>

      <div className="reveal mt-10 bg-sand rounded-sm px-5 py-4 grid grid-cols-2 md:grid-cols-12 gap-x-6 gap-y-3 items-end" style={at(1)}>
        <label className="col-span-2 md:col-span-6 block">
          <span className="eyebrow">Search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Description, vendor, category" className="field" />
        </label>
        <label className="md:col-span-4 block">
          <span className="eyebrow">Category</span>
          <select value={category} onChange={e => setCategory(e.target.value)} className="field">
            <option value="">All</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="md:col-span-2 block">
          <span className="eyebrow">Paid by</span>
          <select value={paidBy} onChange={e => setPaidBy(e.target.value)} className="field">
            <option value="">Both</option>
            <option value="Owner">Owner</option>
            <option value="Builder">Builder</option>
          </select>
        </label>
      </div>

      <div className="reveal hidden md:block mt-6 overflow-x-auto" style={at(2)}>
        <table className="ledger">
          <thead>
            <tr>
              {header('date', 'Date')}
              {header('description', 'Description')}
              {header('category', 'Category')}
              {header('vendor', 'Vendor')}
              {header('paid_by', 'Paid by')}
              {header('amount', 'Amount', true)}
            </tr>
          </thead>
          <tbody>
            {visible.map(e => (
              <tr key={e.id} className={e.counted ? '' : 'text-ink-3'}>
                <td className="whitespace-nowrap text-ink-3 num">{longDate(e.date)}</td>
                <td className="max-w-md">{e.description}</td>
                <td className="text-ink-2">{e.category || <span className="italic text-ink-3">Uncategorized</span>}</td>
                <td className="text-ink-2">{e.vendor || <span className="text-ink-3">—</span>}</td>
                <td><span className={`text-xs font-medium ${e.paid_by === 'Owner' ? 'text-accent' : 'text-ink-2'}`}>{e.paid_by || '—'}</span></td>
                <td className={`text-right whitespace-nowrap num font-medium ${e.counted ? '' : 'line-through'}`}>{money(e.amount, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="reveal md:hidden mt-6 divide-y divide-ink/10" style={at(2)}>
        {visible.map(e => (
          <li key={e.id} className={`py-4 flex gap-4 ${e.counted ? '' : 'text-ink-3'}`}>
            <span className="flex-1 min-w-0">
              <span className="block">{e.description}</span>
              <span className="block text-xs text-ink-3 mt-1">{longDate(e.date)} · {e.category || 'Uncategorized'}{e.vendor && ` · ${e.vendor}`}</span>
            </span>
            <span className="text-right">
              <span className={`block num font-medium ${e.counted ? '' : 'line-through'}`}>{money(e.amount, true)}</span>
              <span className={`text-xs font-medium ${e.paid_by === 'Owner' ? 'text-accent' : 'text-ink-2'}`}>{e.paid_by}</span>
            </span>
          </li>
        ))}
      </ul>

      {visible.length === 0 && <p className="mt-10 font-display italic text-2xl text-ink-3">{data.expenses.length ? 'Nothing matches.' : 'No payments yet.'}</p>}
    </main>
  );
}
