'use client';
import { useEffect, useMemo, useState } from 'react';
import { useCanEdit, useProjectId } from '@/lib/project-context';
import { PAID_BY, PAYMENT_METHODS } from '@/lib/constants';
import { uploadFile as uploadReceipt } from '@/lib/upload-client';
import { money, longDate } from '@/lib/format';
import { at } from '@/lib/reveal';
import { ruleBasedCategorize, UNCATEGORIZED } from '@/lib/smart/categories';
import { extractVendor } from '@/lib/smart/vendor';
import { inferSource } from '@/lib/smart/source';

interface Expense {
  id: string; description: string; amount: number | string; date: string;
  vendor: string; payment_method: string; paid_by: string; notes: string;
  category_name: string; category_id: string; receipt_path: string; allocations: string | null;
}
interface Category { id: string; name: string; }
type SortKey = 'date' | 'description' | 'category_name' | 'vendor' | 'paid_by' | 'amount';
type Form = { description: string; amount: string; date: string; category_id: string; vendor: string; payment_method: string; paid_by: string; notes: string };

const today = () => new Date().toISOString().split('T')[0];

function blankForm(): Form {
  // Remember the last category, vendor and payer so repeat entries are quick.
  const last = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('lastExpense') || '{}') : {};
  return { description: '', amount: '', date: today(), category_id: last.category_id || '', vendor: last.vendor || '', payment_method: last.payment_method || '', paid_by: last.paid_by || '', notes: '' };
}

export default function ExpensesPage() {
  const projectId = useProjectId();
  const canEdit = useCanEdit();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(blankForm);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Expense | null>(null);
  const [editReceipt, setEditReceipt] = useState<File | null>(null);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [paidByFilter, setPaidByFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);

  // Links from the overview (e.g. "Needs a look") land here with filters in the URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setSearch(p.get('q') || '');
    setCatFilter(p.get('category') || '');
    setPaidByFilter(p.get('paidBy') || '');
    setVendorFilter(p.get('vendor') || '');
  }, []);

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
      (!q || [e.description, e.vendor, e.notes, e.category_name].some(v => (v || '').toLowerCase().includes(q))) &&
      (!catFilter || (catFilter === 'none' ? !e.category_id : e.category_id === catFilter)) &&
      (!paidByFilter || (paidByFilter === 'none' ? !e.paid_by : e.paid_by === paidByFilter)) &&
      (!vendorFilter || (vendorFilter === 'none' ? !e.vendor : e.vendor === vendorFilter)) &&
      (!from || e.date >= from) &&
      (!to || e.date <= to));
    return rows.sort((a, b) => {
      const x = sortKey === 'amount' ? Number(a.amount) - Number(b.amount) : String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''));
      return sortAsc ? x : -x;
    });
  }, [expenses, search, catFilter, paidByFilter, vendorFilter, from, to, sortKey, sortAsc]);

  const total = visible.reduce((s, e) => s + Number(e.amount), 0);
  const filtersOn = search || catFilter || paidByFilter || vendorFilter || from || to;

  // Suggestions ported from build-tracker's rules; they only fill empty fields when accepted.
  const suggestion = useMemo(() => {
    if (form.description.trim().length < 4) return null;
    const vendor = !form.vendor ? extractVendor(form.description) : '';
    const rule = ruleBasedCategorize(form.description).category;
    const category = !form.category_id && rule !== UNCATEGORIZED ? categories.find(c => c.name.toLowerCase() === rule.toLowerCase()) : undefined;
    const source = inferSource(form.description);
    const paid_by = !form.paid_by && source !== 'Unknown' ? source : '';
    return vendor || category || paid_by ? { vendor, category, paid_by } : null;
  }, [form.description, form.vendor, form.category_id, form.paid_by, categories]);

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
    if (!canEdit) return;
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
    setEditId(null);
    load();
  }

  function sortBy(key: SortKey) {
    if (key === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key !== 'date' && key !== 'amount'); }
  }

  function clearFilters() {
    setSearch(''); setCatFilter(''); setPaidByFilter(''); setVendorFilter(''); setFrom(''); setTo('');
    window.history.replaceState(null, '', window.location.pathname);
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
    <th className={right ? '!text-right' : ''} aria-sort={sortKey === key ? (sortAsc ? 'ascending' : 'descending') : undefined}>
      <button onClick={() => sortBy(key)} className={`hover:text-ink ${sortKey === key ? 'text-ink' : ''}`}>
        {label}{sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  const editor = edit && (
    <EditPanel edit={edit} setEdit={setEdit} categories={categories} saving={saving}
      onReceipt={setEditReceipt} onSave={saveEdit} onCancel={() => { setEditId(null); setEdit(null); }} onDelete={() => deleteExpense(edit.id)} />
  );

  return (
    <div className="max-w-[1320px]">
      <datalist id="vendor-list">{vendors.map(v => <option key={v} value={v} />)}</datalist>

      <header className="reveal grid lg:grid-cols-12 gap-6 items-end" style={at(0)}>
        <div className="lg:col-span-7">
          <p className="eyebrow">The ledger</p>
          <h1 className="font-display text-6xl lg:text-7xl leading-none mt-2">Expenses</h1>
        </div>
        <div className="lg:col-span-5 flex flex-wrap items-end justify-between gap-4 lg:pb-2">
          <p className="text-ink-2">
            <span className="num font-display text-4xl text-ink">{money(total)}</span>
            <span className="block text-sm text-ink-3">{visible.length}{filtersOn ? ` of ${expenses.length}` : ''} entries</span>
          </p>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="btn-quiet">Export CSV</button>
            {canEdit && <button onClick={() => setShowForm(!showForm)} className={showForm ? 'btn-ink' : 'btn-accent'}>{showForm ? 'Close' : 'Add a payment'}</button>}
          </div>
        </div>
      </header>

      {error && <p role="alert" className="mt-6 text-sm text-accent-deep bg-accent-soft/60 rounded-sm px-4 py-2">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-8 bg-ink text-paper rounded-sm p-6 lg:p-8 grid lg:grid-cols-12 gap-x-8 gap-y-5 [&_.field]:text-paper [&_.field]:border-paper/25 [&_.field]:placeholder:text-paper/40 [&_.eyebrow]:text-paper/50 [&_option]:text-ink">
          <label className="lg:col-span-6 block">
            <span className="eyebrow">What was it for</span>
            <input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Home Depot, recessed lights" className="field text-base" />
          </label>
          <label className="lg:col-span-3 block">
            <span className="eyebrow">Amount</span>
            <input type="number" step="0.01" inputMode="decimal" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="field text-base num" />
          </label>
          <label className="lg:col-span-3 block">
            <span className="eyebrow">Date</span>
            <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="field" />
          </label>

          {suggestion && (
            <div className="lg:col-span-12 flex flex-wrap items-center gap-2 text-sm -mt-1">
              <span className="text-paper/50">Looks like</span>
              {suggestion.vendor && <span className="rounded-full bg-paper/10 px-3 py-1">{suggestion.vendor}</span>}
              {suggestion.category && <span className="rounded-full bg-paper/10 px-3 py-1">{suggestion.category.name}</span>}
              {suggestion.paid_by && <span className="rounded-full bg-accent/90 px-3 py-1">{suggestion.paid_by}</span>}
              <button type="button" className="text-accent-soft underline underline-offset-4 ml-1"
                onClick={() => setForm({ ...form, vendor: form.vendor || suggestion.vendor, category_id: form.category_id || suggestion.category?.id || '', paid_by: form.paid_by || suggestion.paid_by })}>
                Use these
              </button>
            </div>
          )}

          <label className="lg:col-span-4 block">
            <span className="eyebrow">Category</span>
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="field">
              <option value="">Uncategorized</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="lg:col-span-3 block">
            <span className="eyebrow">Vendor</span>
            <input list="vendor-list" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} className="field" />
          </label>
          <fieldset className="lg:col-span-3">
            <legend className="eyebrow">Paid by</legend>
            <div className="mt-2 flex gap-2">
              {PAID_BY.map(p => (
                <button type="button" key={p} onClick={() => setForm({ ...form, paid_by: form.paid_by === p ? '' : p })} aria-pressed={form.paid_by === p}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${form.paid_by === p ? (p === 'Owner' ? 'bg-accent' : 'bg-paper text-ink') : 'bg-paper/10 hover:bg-paper/20'}`}>
                  {p}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="lg:col-span-2 block">
            <span className="eyebrow">Method</span>
            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="field">
              <option value="">—</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="lg:col-span-6 block">
            <span className="eyebrow">Notes</span>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="field" />
          </label>
          <label className="lg:col-span-4 block">
            <span className="eyebrow">Receipt or invoice</span>
            <input type="file" accept="image/*,.pdf" capture="environment" onChange={e => setReceiptFile(e.target.files?.[0] || null)}
              className="mt-2 block text-sm text-paper/60 file:mr-3 file:rounded-full file:border-0 file:bg-paper/10 file:px-4 file:py-1.5 file:text-paper" />
          </label>
          <div className="lg:col-span-2 flex items-end">
            <button type="submit" disabled={saving} className="btn-accent w-full justify-center">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}

      <div className="reveal mt-10 bg-sand rounded-sm px-5 py-4 grid grid-cols-2 md:grid-cols-12 gap-x-6 gap-y-3 items-end" style={at(1)}>
        <label className="col-span-2 md:col-span-3 block">
          <span className="eyebrow flex justify-between">Search
            {filtersOn && <button type="button" onClick={clearFilters} className="normal-case tracking-normal text-xs font-medium text-accent hover:underline underline-offset-4">Clear filters</button>}
          </span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Description, vendor, notes" className="field" />
        </label>
        <label className="md:col-span-2 block">
          <span className="eyebrow">Category</span>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="field">
            <option value="">All</option>
            <option value="none">Uncategorized</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="md:col-span-2 block">
          <span className="eyebrow">Vendor</span>
          <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} className="field">
            <option value="">All</option>
            <option value="none">Not recorded</option>
            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="md:col-span-1 block">
          <span className="eyebrow">Paid by</span>
          <select value={paidByFilter} onChange={e => setPaidByFilter(e.target.value)} className="field">
            <option value="">Both</option>
            {PAID_BY.map(p => <option key={p} value={p}>{p}</option>)}
            <option value="none">Not set</option>
          </select>
        </label>
        <label className="md:col-span-2 block">
          <span className="eyebrow">From</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="field" />
        </label>
        <label className="md:col-span-2 block">
          <span className="eyebrow">To</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="field" />
        </label>
      </div>

      {/* Wide screens: a ledger table */}
      <div className="reveal hidden md:block mt-6 overflow-x-auto" style={at(2)}>
        <table className="ledger">
          <thead>
            <tr>
              {header('date', 'Date')}
              {header('description', 'Description')}
              {header('category_name', 'Category')}
              {header('vendor', 'Vendor')}
              {header('paid_by', 'Paid by')}
              {header('amount', 'Amount', true)}
            </tr>
          </thead>
          <tbody>
            {visible.map(exp => editId === exp.id ? (
              <tr key={exp.id}><td colSpan={6} className="!p-0">{editor}</td></tr>
            ) : (
              <tr key={exp.id} onClick={() => startEdit(exp)} className={canEdit ? 'cursor-pointer hover:bg-sand/50 transition-colors' : ''}>
                <td className="whitespace-nowrap text-ink-3 num">{longDate(exp.date)}</td>
                <td className="max-w-md">
                  <span>{exp.description}</span>
                  {exp.receipt_path && <a href={exp.receipt_path} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="ml-2 text-xs text-accent underline underline-offset-2">receipt</a>}
                  {exp.notes && <p className="text-xs text-ink-3 mt-0.5">{exp.notes}</p>}
                  {exp.allocations && <p className="text-xs text-ink-3 mt-0.5">Split across categories</p>}
                </td>
                <td className="text-ink-2">{exp.category_name || <span className="italic text-ink-3">Uncategorized</span>}</td>
                <td className="text-ink-2">{exp.vendor || <span className="text-ink-3">—</span>}</td>
                <td><Payer value={exp.paid_by} /></td>
                <td className="text-right whitespace-nowrap num font-medium">{money(Number(exp.amount), true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: a stacked list */}
      <ul className="reveal md:hidden mt-6 divide-y divide-ink/10" style={at(2)}>
        {visible.map(exp => (
          <li key={exp.id}>
            {editId === exp.id ? editor : canEdit ? (
              <button onClick={() => startEdit(exp)} className="w-full text-left py-4 flex gap-4">
                <PhoneRow exp={exp} />
              </button>
            ) : (
              <div className="py-4 flex gap-4">
                <PhoneRow exp={exp} />
              </div>
            )}
            {!canEdit && exp.receipt_path && <a href={exp.receipt_path} target="_blank" rel="noreferrer" className="-mt-2 mb-3 inline-block text-xs text-accent underline underline-offset-2">Open receipt</a>}
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="mt-10 font-display italic text-2xl text-ink-3">
          {expenses.length ? 'Nothing matches these filters.' : canEdit ? 'No payments yet. Add one, or import your sheet.' : 'No payments yet.'}
        </p>
      )}
      {visible.length > 0 && canEdit && <p className="mt-6 text-xs text-ink-3">Click a row to edit it.</p>}
    </div>
  );
}

function PhoneRow({ exp }: { exp: Expense }) {
  return (
    <>
      <span className="flex-1 min-w-0">
        <span className="block">{exp.description}</span>
        <span className="block text-xs text-ink-3 mt-1">{longDate(exp.date)} · {exp.category_name || 'Uncategorized'}{exp.vendor && ` · ${exp.vendor}`}</span>
      </span>
      <span className="text-right">
        <span className="block num font-medium">{money(Number(exp.amount), true)}</span>
        <Payer value={exp.paid_by} />
      </span>
    </>
  );
}

function Payer({ value }: { value: string }) {
  if (!value) return <span className="text-xs text-ink-3">—</span>;
  return <span className={`text-xs font-medium ${value === 'Owner' ? 'text-accent' : 'text-ink-2'}`}>{value}</span>;
}

function EditPanel({ edit, setEdit, categories, saving, onReceipt, onSave, onCancel, onDelete }: {
  edit: Expense; setEdit: (e: Expense) => void; categories: Category[]; saving: boolean;
  onReceipt: (f: File | null) => void; onSave: () => void; onCancel: () => void; onDelete: () => void;
}) {
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(); }} className="bg-sand rounded-sm p-5 my-2 grid grid-cols-2 md:grid-cols-12 gap-x-6 gap-y-4">
      <label className="col-span-2 md:col-span-5 block">
        <span className="eyebrow">Description</span>
        <input value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} className="field" autoFocus />
      </label>
      <label className="md:col-span-2 block">
        <span className="eyebrow">Amount</span>
        <input type="number" step="0.01" value={edit.amount} onChange={e => setEdit({ ...edit, amount: e.target.value })} className="field num" />
      </label>
      <label className="md:col-span-2 block">
        <span className="eyebrow">Date</span>
        <input type="date" value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value })} className="field" />
      </label>
      <label className="col-span-2 md:col-span-3 block">
        <span className="eyebrow">Category</span>
        <select value={edit.category_id || ''} onChange={e => setEdit({ ...edit, category_id: e.target.value })} className="field">
          <option value="">Uncategorized</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="md:col-span-3 block">
        <span className="eyebrow">Vendor</span>
        <input list="vendor-list" value={edit.vendor || ''} onChange={e => setEdit({ ...edit, vendor: e.target.value })} className="field" />
      </label>
      <label className="md:col-span-2 block">
        <span className="eyebrow">Paid by</span>
        <select value={edit.paid_by || ''} onChange={e => setEdit({ ...edit, paid_by: e.target.value })} className="field">
          <option value="">Not set</option>
          {PAID_BY.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label className="col-span-2 md:col-span-4 block">
        <span className="eyebrow">Notes</span>
        <input value={edit.notes || ''} onChange={e => setEdit({ ...edit, notes: e.target.value })} className="field" />
      </label>
      <label className="col-span-2 md:col-span-3 block">
        <span className="eyebrow">{edit.receipt_path ? 'Replace receipt' : 'Attach receipt'}</span>
        <input type="file" accept="image/*,.pdf" onChange={e => onReceipt(e.target.files?.[0] || null)}
          className="mt-2 block w-full text-xs text-ink-3 file:mr-2 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-1 file:text-ink" />
      </label>
      <div className="col-span-2 md:col-span-12 flex flex-wrap items-center gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-ink">{saving ? 'Saving…' : 'Save changes'}</button>
        <button type="button" onClick={onCancel} className="btn-quiet">Cancel</button>
        <button type="button" onClick={onDelete} className="btn-quiet ml-auto !text-accent-deep hover:!bg-accent-soft/50">Delete</button>
      </div>
    </form>
  );
}
