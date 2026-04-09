'use client';
import { useEffect, useState } from 'react';
import { useProjectId } from '@/lib/project-context';
import { PAYMENT_METHODS } from '@/lib/constants';

interface Expense {
  id: string; description: string; amount: number; date: string;
  vendor: string; payment_method: string; notes: string; category_name: string;
  category_id: string; receipt_path: string;
}
interface Category { id: string; name: string; }

export default function ExpensesPage() {
  const projectId = useProjectId();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category_id: '', vendor: '', payment_method: '', notes: '' });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    if (!projectId) return;
    fetch(`/api/expenses?projectId=${projectId}`).then(r => r.json()).then(setExpenses);
    fetch(`/api/categories?projectId=${projectId}`).then(r => r.json()).then(setCategories);
  }

  useEffect(load, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let receipt_path = '';
    if (receiptFile) {
      const fd = new FormData();
      fd.append('file', receiptFile);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
      const uploadData = await uploadRes.json();
      receipt_path = uploadData.path || '';
    }

    await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount), project_id: projectId, receipt_path }),
    });

    setForm({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category_id: '', vendor: '', payment_method: '', notes: '' });
    setReceiptFile(null);
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    load();
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Expenses</h2>
          <p className="text-gray-500">{expenses.length} entries · Total: ${total.toLocaleString()}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          {showForm ? '✕ Cancel' : '+ Add Expense'}
        </button>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-700">New Expense</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Description *" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <input type="number" step="0.01" placeholder="Amount *" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
              className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}
              className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Vendor / Supplier" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })}
              className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}
              className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Payment Method</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          <div>
            <label className="text-sm text-gray-600 block mb-1">Receipt / Invoice (optional)</label>
            <input type="file" accept="image/*,.pdf" onChange={e => setReceiptFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium" />
          </div>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
            {saving ? 'Saving...' : 'Save Expense'}
          </button>
        </form>
      )}

      {/* Expense List */}
      <div className="space-y-3">
        {expenses.map(exp => (
          <div key={exp.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-800 truncate">{exp.description}</p>
                {exp.receipt_path && <span title="Has receipt" className="text-green-500">📎</span>}
              </div>
              <p className="text-sm text-gray-500">
                {exp.category_name || 'Uncategorized'} · {exp.date}
                {exp.vendor && ` · ${exp.vendor}`}
                {exp.payment_method && ` · ${exp.payment_method}`}
              </p>
              {exp.notes && <p className="text-xs text-gray-400 mt-1">{exp.notes}</p>}
            </div>
            <div className="flex items-center gap-3 ml-4">
              <span className="font-bold text-gray-800 text-lg">${Number(exp.amount).toLocaleString()}</span>
              <button onClick={() => deleteExpense(exp.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition text-sm">🗑️</button>
            </div>
          </div>
        ))}
        {expenses.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">📝</p>
            <p>No expenses yet. Click &quot;Add Expense&quot; to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
