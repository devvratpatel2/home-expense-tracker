'use client';
import { useEffect, useState } from 'react';
import { useProjectId } from '@/lib/project-context';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieLabelRenderProps } from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6'];

interface DashboardData {
  totalSpent: number;
  budget: number;
  expenseCount: number;
  remaining: number;
  byCategory: { name: string; total: number }[];
  monthly: { month: string; total: number }[];
  recentExpenses: { id: string; description: string; amount: number; date: string; category_name: string }[];
}

export default function DashboardPage() {
  const projectId = useProjectId();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/dashboard?projectId=${projectId}`).then(r => r.json()).then(setData);
  }, [projectId]);

  if (!data) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 rounded-xl" /><div className="h-64 bg-gray-200 rounded-xl" /></div>;

  const budgetPercent = data.budget > 0 ? Math.min((data.totalSpent / data.budget) * 100, 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Spent" value={`$${data.totalSpent.toLocaleString()}`} icon="💸" color="blue" />
        <StatCard label="Budget" value={`$${(data.budget as number).toLocaleString()}`} icon="🎯" color="green" />
        <StatCard label="Remaining" value={`$${data.remaining.toLocaleString()}`} icon={data.remaining >= 0 ? '✅' : '⚠️'} color={data.remaining >= 0 ? 'emerald' : 'red'} />
        <StatCard label="Transactions" value={String(data.expenseCount)} icon="📝" color="purple" />
      </div>

      {/* Budget Progress */}
      {data.budget > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">Budget Progress</h3>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div className={`h-4 rounded-full transition-all ${budgetPercent > 90 ? 'bg-red-500' : budgetPercent > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${budgetPercent}%` }} />
          </div>
          <p className="text-sm text-gray-500 mt-2">{budgetPercent.toFixed(1)}% of budget used</p>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.byCategory.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-4">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.byCategory} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(props: PieLabelRenderProps) => `${props.name || ''} ${((props.percent || 0) * 100).toFixed(0)}%`}>
                  {data.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.monthly.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-4">Monthly Spending</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.monthly}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Expenses */}
      {data.recentExpenses.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Recent Expenses</h3>
          <div className="space-y-3">
            {data.recentExpenses.map(exp => (
              <div key={exp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-gray-800">{exp.description}</p>
                  <p className="text-sm text-gray-500">{exp.category_name || 'Uncategorized'} · {exp.date}</p>
                </div>
                <span className="font-semibold text-gray-800">${Number(exp.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.byCategory.length === 0 && (
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <p className="text-4xl mb-4">🏠</p>
          <h3 className="text-xl font-semibold text-gray-700">No expenses yet!</h3>
          <p className="text-gray-500 mt-2">Start by adding your first expense or importing from a spreadsheet.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const bgMap: Record<string, string> = { blue: 'bg-blue-50', green: 'bg-green-50', emerald: 'bg-emerald-50', red: 'bg-red-50', purple: 'bg-purple-50' };
  return (
    <div className={`${bgMap[color] || 'bg-gray-50'} rounded-xl p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-800 mt-2">{value}</p>
    </div>
  );
}
