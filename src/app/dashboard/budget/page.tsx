'use client';
import { useEffect, useState } from 'react';
import { useProjectId } from '@/lib/project-context';

interface Category { id: string; name: string; budget: number; spent: number; expense_count: number; }
interface Project { id: string; name: string; budget: number; }

const money = (n: number) => `$${Math.round(Number(n)).toLocaleString()}`;
const toNumber = (v: string) => parseFloat(v.replace(/[$,]/g, '')) || 0;

export default function BudgetPage() {
  const projectId = useProjectId();
  const [project, setProject] = useState<Project | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');

  function load() {
    if (!projectId) return;
    fetch('/api/projects').then(r => r.json()).then((ps: Project[]) => setProject(ps.find(p => p.id === projectId) || null));
    fetch(`/api/categories?projectId=${projectId}`).then(r => r.json()).then(setCategories);
  }

  useEffect(load, [projectId]);

  async function saveProject(fields: Partial<Project>) {
    await fetch('/api/projects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: projectId, ...fields }) });
    load();
  }

  async function saveCategory(id: string, fields: Partial<Category>) {
    await fetch('/api/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...fields }) });
    load();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: projectId, name: newName }) });
    setNewName('');
    load();
  }

  async function deleteCategory(c: Category) {
    const msg = c.expense_count > 0 ? `Delete "${c.name}"? Its ${c.expense_count} expenses will become Uncategorized.` : `Delete "${c.name}"?`;
    if (!confirm(msg)) return;
    await fetch(`/api/categories?id=${c.id}`, { method: 'DELETE' });
    load();
  }

  if (!project) return null;

  const sorted = [...categories].sort((a, b) => Number(b.spent) - Number(a.spent));
  const allocated = categories.reduce((s, c) => s + Number(c.budget), 0);
  const spent = categories.reduce((s, c) => s + Number(c.spent), 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-800">Budget & Categories</h2>

      <div className="bg-white rounded-xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="text-sm text-gray-600">
          Project name
          <input defaultValue={project.name} key={`n-${project.name}`} onBlur={e => e.target.value !== project.name && saveProject({ name: e.target.value })}
            className="mt-1 w-full px-3 py-2 border rounded-lg" />
        </label>
        <label className="text-sm text-gray-600">
          Total budget
          <input defaultValue={project.budget || ''} key={`b-${project.budget}`} inputMode="decimal" placeholder="e.g. 763390"
            onBlur={e => toNumber(e.target.value) !== Number(project.budget) && saveProject({ budget: toNumber(e.target.value) })}
            className="mt-1 w-full px-3 py-2 border rounded-lg" />
        </label>
        <div className="text-sm text-gray-600">
          Allocated to categories
          <p className="mt-2 text-lg font-semibold text-gray-800">{money(allocated)}</p>
          {project.budget > 0 && <p className="text-xs text-gray-400">{money(project.budget - allocated)} unallocated</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Spent</th>
              <th className="px-3 py-2 text-right font-medium">Budget</th>
              <th className="px-3 py-2 text-left font-medium w-48">Used</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => {
              const used = c.budget > 0 ? (Number(c.spent) / Number(c.budget)) * 100 : 0;
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-3 py-1.5">
                    <input defaultValue={c.name} key={`cn-${c.id}-${c.name}`} onBlur={e => e.target.value.trim() && e.target.value !== c.name && saveCategory(c.id, { name: e.target.value })}
                      className="w-full px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-blue-400 outline-none" aria-label="Category name" />
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{money(c.spent)} <span className="text-xs text-gray-400">({c.expense_count})</span></td>
                  <td className="px-3 py-1.5 text-right">
                    <input defaultValue={c.budget || ''} key={`cb-${c.id}-${c.budget}`} inputMode="decimal" placeholder="—"
                      onBlur={e => toNumber(e.target.value) !== Number(c.budget) && saveCategory(c.id, { budget: toNumber(e.target.value) })}
                      className="w-28 px-2 py-1 text-right rounded border border-gray-200 focus:border-blue-400 outline-none" aria-label={`Budget for ${c.name}`} />
                  </td>
                  <td className="px-3 py-1.5">
                    {c.budget > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full">
                          <div className={`h-2 rounded-full ${used > 100 ? 'bg-red-500' : used > 90 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(used, 100)}%` }} />
                        </div>
                        <span className={`text-xs w-10 text-right ${used > 100 ? 'text-red-600' : 'text-gray-500'}`}>{Math.round(used)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => deleteCategory(c)} title="Delete category" className="text-gray-300 hover:text-red-600">🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-gray-50 font-semibold">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{money(spent)}</td>
              <td className="px-3 py-2 text-right">{money(allocated)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <form onSubmit={addCategory} className="flex gap-2">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New category name" className="flex-1 px-3 py-2 border rounded-lg text-sm" />
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Add category</button>
      </form>
      <p className="text-xs text-gray-400">Edits save when you click out of a field. Spent includes only categorized expenses.</p>
    </div>
  );
}
