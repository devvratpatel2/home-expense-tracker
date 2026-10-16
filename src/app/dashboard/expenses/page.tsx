'use client';
import { useEffect, useMemo, useState } from 'react';
import { useProjectId } from '@/lib/project-context';
import { PAID_BY, PAYMENT_METHODS } from '@/lib/constants';
import { uploadFile as uploadReceipt } from '@/lib/upload-client';

interface Expense {
  id: string; description: string; amount: number; date: string;
  vendor: string; payment_method: string; paid_by: string; notes: string;
  category_name: string; category_id: string; receipt_path: string;
}
interface Category { id: string; name: string; }
type SortKey = 'date' | 'description' | 'category_name' | 'vendor' | 'paid_by' | 'amount';

const today = () => new Date().toISOString().split('T')[0];
const money = (n: number) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const input = 'px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';
const cellInput = 'w-full px-2 py-1 border rounded text-sm';

function blankForm() {
  // Remember the last category, vendor and payer so repeat entries are quick.
  const last = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('lastExpense') || '{}') : {};
  return { description: '', amount: '', date: today(), category_id: last.category_id || '', vendor: last.vendor || '', payment_method: last.payment_method || '', paid_by: last.paid_by || '', notes: '' };
}

export default function ExpensesPage() {
  const projectId = useProjectId();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Expense | null>(null);
  const [editReceipt, setEditReceipt] = useState<File | null>(null);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [paidByFilter, setPaidByFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);

  function load() {
    if (!projectId) return;
    fetch(`/api/expenses?projectId=${projectId}`).then(r => r.json()).then(setExpenses);
    fetch(`/api/categories?projectId=${projectId}`).then(r => r.json()).then(setCategories);
  }

  useEffect(load, [projectId]);

  const vendors = useMemo(() => Array.from(new Set(expenses.map(e => e.vendor).filter(Boolean))).sort(), [expenses]);

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    const rows = expenses.filter(e =>
      (!q || [e.description, e.vendor, e.notes].some(v => (v || '').toLowerCase().includes(q))) &&
      (!catFilter || (catFilter === 'none' ? !e.category_id : e.category_id === catFilter)) &&
      (!paidByFilter || (paidByFilter === 'none' ? !e.paid_by : e.paid_by === paidByFilter)) &&
      (!from || e.date >= from) &&
      (!to || e.date <= to));
    return rows.sort((a, b) => {
      const x = sortKey === 'amount' ? Number(a.amount) - Number(b.amount) : String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''));
      return sortAsc ? x : -x;
    });
  }, [expenses, search, catFilter, paidByFilter, from, to, sortKey, sortAsc]);

  const total = visible.reduce((s, e) => s + Number(e.amount), 0);
  const filtersOn = search || catFilter || paidByFilter || from || to;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const receipt_path = receiptFile ? await uploadReceipt(receiptFile) : '';
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount), project_id: projectId, receipt_path }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      localStorage.setItem('lastExpense', JSON.stringify({ category_id: form.category_id, vendor: form.vendor, payment_method: form.payment_method, paid_by: form.paid_by }));
      setForm(blankForm());
      setReceiptFile(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(exp: Expense) {
    setEditId(exp.id);
    setEdit({ ...exp });
    setEditReceipt(null);
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    setError('');
    try {
      const receipt_path = editReceipt ? await uploadReceipt(editReceipt) : edit.receipt_path;
      const res = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...edit, amount: Number(edit.amount), receipt_path }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setEditId(null);
      setEdit(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    load();
  }

  function sortBy(key: SortKey) {
    if (key === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key !== 'date' && key !== 'amount'); }
  }

  function exportCsv() {
    const header = ['Date', 'Amount', 'Description', 'Category', 'Vendor', 'Source', 'Payment Method', 'Notes'];
    const quote = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = visible.map(e => [e.date, Number(e.amount).toFixed(2), e.description, e.category_name, e.vendor, e.paid_by, e.payment_method, e.notes].map(quote).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `expenses-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const header = (key: SortKey, label: string, right = false) => (
    <th className={`px-3 py-2 font-medium text-gray-600 ${right ? 'text-right' : 'text-left'}`}>
      <button onClick={() => sortBy(key)} className="hover:text-blue-600">
        {label}{sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );

  return (
    <div className="space-y-4 max-w-7xl">
      <datalist id="vendor-list">{vendors.map(v => <option key={v} value={v} />)}</datalist>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Expenses</h2>
          <p className="text-gray-500 text-sm">
            {visible.length}{filtersOn ? ` of ${expenses.length}` : ''} entries · Total: {money(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Export CSV</button>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            {showForm ? '✕ Cancel' : '+ Add Expense'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input placeholder="Description *" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${input} lg:col-span-2`} />
            <input type="number" step="0.01" inputMode="decimal" placeholder="Amount *" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={input} />
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={input} />
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className={input}>
              <option value="">Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Vendor" list="vendor-list" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} className={input} />
            <select value={form.paid_by} onChange={e => setForm({ ...form, paid_by: e.target.value })} className={input}>
              <option value="">Paid by</option>
              {PAID_BY.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className={input}>
              <option value="">Payment method</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={`${input} w-full`} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm text-gray-600">
              Receipt / invoice{' '}
              <input type="file" accept="image/*,.pdf" capture="environment" onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700" />
            </label>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm">
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl p-3 shadow-sm flex flex-wrap gap-2 items-center">
        <input placeholder="Search description, vendor, notes" value={search} onChange={e => setSearch(e.target.value)} className={`${input} flex-1 min-w-[200px]`} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className={input} aria-label="Filter by category">
          <option value="">All categories</option>
          <option value="none">Uncategorized</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={paidByFilter} onChange={e => setPaidByFilter(e.target.value)} className={input} aria-label="Filter by payer">
          <option value="">Owner + Builder</option>
          {PAID_BY.map(p => <option key={p} value={p}>{p}</option>)}
          <option value="none">Not set</option>
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={input} aria-label="From date" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className={input} aria-label="To date" />
        {filtersOn && (
          <button onClick={() => { setSearch(''); setCatFilter(''); setPaidByFilter(''); setFrom(''); setTo(''); }} className="text-sm text-blue-600 px-2">Clear</button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {header('date', 'Date')}
              {header('description', 'Description')}
              {header('category_name', 'Category')}
              {header('vendor', 'Vendor')}
              {header('paid_by', 'Paid by')}
              {header('amount', 'Amount', true)}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map(exp => editId === exp.id && edit ? (
              <tr key={exp.id} className="border-b bg-blue-50 align-top">
                <td className="px-2 py-2"><input type="date" value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value })} className={cellInput} /></td>
                <td className="px-2 py-2 min-w-[220px] space-y-1">
                  <input value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} className={cellInput} />
                  <input placeholder="Notes" value={edit.notes || ''} onChange={e => setEdit({ ...edit, notes: e.target.value })} className={cellInput} />
                  <input type="file" accept="image/*,.pdf" onChange={e => setEditReceipt(e.target.files?.[0] || null)} className="text-xs text-gray-500" />
                </td>
                <td className="px-2 py-2">
                  <select value={edit.category_id || ''} onChange={e => setEdit({ ...edit, category_id: e.target.value })} className={cellInput}>
                    <option value="">Uncategorized</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2"><input list="vendor-list" value={edit.vendor || ''} onChange={e => setEdit({ ...edit, vendor: e.target.value })} className={cellInput} /></td>
                <td className="px-2 py-2">
                  <select value={edit.paid_by || ''} onChange={e => setEdit({ ...edit, paid_by: e.target.value })} className={`${cellInput} min-w-[90px]`}>
                    <option value="">—</option>
                    {PAID_BY.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2"><input type="number" step="0.01" value={edit.amount} onChange={e => setEdit({ ...edit, amount: e.target.value as unknown as number })} className={`${cellInput} text-right w-28`} /></td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <button onClick={saveEdit} disabled={saving} className="text-blue-600 font-medium mr-2">{saving ? '…' : 'Save'}</button>
                  <button onClick={() => { setEditId(null); setEdit(null); }} className="text-gray-500">Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={exp.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => startEdit(exp)}>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{exp.date}</td>
                <td className="px-3 py-2">
                  <span className="text-gray-800">{exp.description}</span>
                  {exp.notes && <p className="text-xs text-gray-400">{exp.notes}</p>}
                </td>
                <td className="px-3 py-2 text-gray-600">{exp.category_name || <span className="text-amber-600">Uncategorized</span>}</td>
                <td className="px-3 py-2 text-gray-600">{exp.vendor || <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2">
                  {exp.paid_by && <span className={`px-2 py-0.5 rounded-full text-xs ${exp.paid_by === 'Owner' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>{exp.paid_by}</span>}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">{money(exp.amount)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                  {exp.receipt_path && <a href={exp.receipt_path} target="_blank" rel="noreferrer" title="Open receipt" className="mr-3">📎</a>}
                  <button onClick={() => deleteExpense(exp.id)} title="Delete" className="text-gray-300 hover:text-red-600">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {expenses.length ? 'No expenses match these filters.' : 'No expenses yet. Click "Add Expense" or import your sheet.'}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">Click any row to edit it.</p>
    </div>
  );
}
