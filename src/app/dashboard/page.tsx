'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectId } from '@/lib/project-context';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface DashboardData {
  totalSpent: number;
  budget: number;
  expenseCount: number;
  remaining: number;
  byPaidBy: { Owner: number; Builder: number; Unassigned: number };
  byCategory: { name: string; total: number; budget: number }[];
  monthly: { month: string; Owner: number; Builder: number; Unassigned: number; cumulative: number }[];
  topVendors: { name: string; total: number }[];
  recentExpenses: { id: string; description: string; amount: number; date: string; category_name: string; paid_by: string }[];
}

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(Number(n))).toLocaleString()}`;
const short = (n: number) => (Math.abs(n) >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);
const OWNER = '#10B981';
const BUILDER = '#6366F1';
const OTHER = '#9CA3AF';

export default function DashboardPage() {
  const projectId = useProjectId();
  const [data, setData] = useState<DashboardData | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  function load() {
    if (!projectId) return;
    fetch(`/api/dashboard?projectId=${projectId}`).then(r => r.json()).then(setData);
  }

  useEffect(load, [projectId]);

  async function saveBudget() {
    await fetch('/api/projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: projectId, budget: parseFloat(budgetInput.replace(/[$,]/g, '')) || 0 }),
    });
    setEditingBudget(false);
    load();
  }

  if (!data) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 rounded-xl" /><div className="h-64 bg-gray-200 rounded-xl" /></div>;

  if (data.expenseCount === 0) {
    return (
      <div className="bg-white rounded-xl p-12 shadow-sm text-center max-w-2xl">
        <p className="text-4xl mb-4">🏠</p>
        <h3 className="text-xl font-semibold text-gray-700">No expenses yet</h3>
        <p className="text-gray-500 mt-2">
          <Link href="/dashboard/expenses" className="text-blue-600">Add an expense</Link> or{' '}
          <Link href="/dashboard/import" className="text-blue-600">import your sheet</Link>.
        </p>
      </div>
    );
  }

  const budgetPercent = data.budget > 0 ? (data.totalSpent / data.budget) * 100 : 0;

  const categoryRows = data.byCategory;
  const hasCategoryBudgets = data.byCategory.some(c => c.budget > 0);
  const overBudget = data.byCategory.filter(c => c.budget > 0 && c.total > c.budget);

  return (
    <div className="space-y-6 max-w-7xl">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total spent" value={money(data.totalSpent)} sub={`${data.expenseCount} payments`} />
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">Budget</p>
          {editingBudget ? (
            <form onSubmit={e => { e.preventDefault(); saveBudget(); }} className="mt-1 flex gap-2">
              <input autoFocus value={budgetInput} onChange={e => setBudgetInput(e.target.value)} className="w-full px-2 py-1 border rounded text-lg" aria-label="Project budget" />
              <button className="text-blue-600 text-sm">Save</button>
            </form>
          ) : (
            <button onClick={() => { setBudgetInput(String(data.budget || '')); setEditingBudget(true); }} className="text-2xl font-bold text-gray-800 mt-1 hover:text-blue-600">
              {data.budget ? money(data.budget) : 'Set budget'}
            </button>
          )}
          <p className="text-xs text-gray-400 mt-1">click to edit</p>
        </div>
        <StatCard label="Remaining" value={data.budget ? money(data.remaining) : '—'} tone={data.budget && data.remaining < 0 ? 'red' : undefined}
          sub={data.budget ? `${budgetPercent.toFixed(1)}% used` : 'set a budget'} />
        <StatCard label="Paid by owner" value={money(data.byPaidBy.Owner)} sub={`${pct(data.byPaidBy.Owner, data.totalSpent)} of total`} dot={OWNER} />
        <StatCard label="Paid by builder" value={money(data.byPaidBy.Builder)} sub={`${pct(data.byPaidBy.Builder, data.totalSpent)} of total`} dot={BUILDER} />
      </div>

      {data.budget > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-gray-700">Budget used</span>
            <span className={budgetPercent > 100 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
              {budgetPercent > 100 ? `${money(-data.remaining)} over budget` : `${money(data.remaining)} left`}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className={`h-3 rounded-full ${budgetPercent > 100 ? 'bg-red-500' : budgetPercent > 90 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Cumulative spend vs budget">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.monthly} margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={short} tick={{ fontSize: 11 }} width={56} domain={[0, (max: number) => Math.max(max, data.budget) * 1.05]} />
              <Tooltip formatter={v => money(Number(v))} />
              {data.budget > 0 && <ReferenceLine y={data.budget} stroke="#EF4444" strokeDasharray="6 4" label={{ value: 'Budget', position: 'insideTopLeft', fontSize: 11, fill: '#EF4444' }} />}
              <Line type="monotone" dataKey="cumulative" name="Spent to date" stroke="#2563EB" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Monthly spend by who paid">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={short} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={v => money(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Owner" stackId="a" fill={OWNER} />
              <Bar dataKey="Builder" stackId="a" fill={BUILDER} />
              {data.byPaidBy.Unassigned > 0 && <Bar dataKey="Unassigned" stackId="a" fill={OTHER} />}
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Panel title={hasCategoryBudgets ? 'Spend vs budget by category' : 'Spend by category'}
            action={<Link href="/dashboard/budget" className="text-sm text-blue-600">{hasCategoryBudgets ? 'Edit budgets' : 'Set category budgets'}</Link>}>
            <ResponsiveContainer width="100%" height={Math.max(260, categoryRows.length * 24 + 40)}>
              <BarChart data={categoryRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={short} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={210} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip formatter={v => money(Number(v))} />
                {hasCategoryBudgets && <Legend wrapperStyle={{ fontSize: 12 }} />}
                <Bar dataKey="total" name="Spent" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                {hasCategoryBudgets && <Bar dataKey="budget" name="Budget" fill="#D1D5DB" radius={[0, 4, 4, 0]} />}
              </BarChart>
            </ResponsiveContainer>
            {overBudget.length > 0 && (
              <p className="text-sm text-red-600 mt-2">Over budget: {overBudget.map(c => `${c.name} (+${money(c.total - c.budget)})`).join(', ')}</p>
            )}
          </Panel>
        </div>

        <Panel title="Top vendors">
          <div className="space-y-2">
            {data.topVendors.map(v => (
              <div key={v.name}>
                <div className="flex justify-between text-sm">
                  <span className={v.name === '(no vendor)' ? 'text-amber-600' : 'text-gray-700'}>{v.name}</span>
                  <span className="font-medium text-gray-800">{money(v.total)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full">
                  <div className="h-1.5 bg-blue-400 rounded-full" style={{ width: `${(v.total / data.topVendors[0].total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Recent expenses" action={<Link href="/dashboard/expenses" className="text-sm text-blue-600">View all</Link>}>
        <div className="divide-y">
          {data.recentExpenses.map(exp => (
            <div key={exp.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-gray-800">{exp.description}</p>
                <p className="text-xs text-gray-500">{exp.category_name || 'Uncategorized'} · {exp.date}{exp.paid_by ? ` · ${exp.paid_by}` : ''}</p>
              </div>
              <span className="font-semibold text-gray-800">{money(exp.amount)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function pct(part: number, total: number) {
  return total ? `${Math.round((part / total) * 100)}%` : '0%';
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, tone, dot }: { label: string; value: string; sub?: string; tone?: 'red'; dot?: string }) {
  return (
    <div className={`rounded-xl p-5 shadow-sm ${tone === 'red' ? 'bg-red-50' : 'bg-white'}`}>
      <p className="text-sm text-gray-500 flex items-center gap-2">
        {dot && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: dot }} />}
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${tone === 'red' ? 'text-red-700' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
