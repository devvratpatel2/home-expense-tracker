'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectId } from '@/lib/project-context';
import { money, pct } from '@/lib/format';
import { at } from '@/lib/reveal';

interface Category { id: string; name: string; budget: number; expense_count: number; }
interface Project { id: string; name: string; budget: number; budget_sheet_url?: string; }
interface Spend { name: string; total: number; owner: number; builder: number; budget: number }
interface Saving { name: string; budget: number; spent: number; saved: number }

const toNumber = (v: string) => parseFloat(v.replace(/[$,\s]/g, '')) || 0;

export default function BudgetPage() {
  const projectId = useProjectId();
  const [project, setProject] = useState<Project | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [spend, setSpend] = useState<Map<string, Spend>>(new Map());
  const [savings, setSavings] = useState<Saving[]>([]);
  const [newName, setNewName] = useState('');

  function load() {
    if (!projectId) return;
    fetch('/api/projects').then(r => r.json()).then((ps: Project[]) => setProject(ps.find(p => p.id === projectId) || null));
    fetch(`/api/categories?projectId=${projectId}`).then(r => r.json()).then(setCategories);
    fetch(`/api/dashboard?projectId=${projectId}`).then(r => r.json()).then(d => {
      setSpend(new Map((d.byCategory as Spend[]).map(c => [c.name, c])));
      setSavings(d.ownerSavings);
    });
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

  if (!project) return <p className="font-display italic text-2xl text-ink-3">Loading the budget…</p>;

  const spentOf = (c: Category) => spend.get(c.name)?.total ?? 0;
  const sorted = [...categories].sort((a, b) => spentOf(b) - spentOf(a) || Number(b.budget) - Number(a.budget));
  const allocated = categories.reduce((s, c) => s + Number(c.budget), 0);
  const spent = Array.from(spend.values()).reduce((s, c) => s + c.total, 0);
  const totalSaved = savings.reduce((s, c) => s + c.saved, 0);

  return (
    <div className="max-w-[1320px]">
      <div className="grid lg:grid-cols-12 gap-x-10 gap-y-10">
        <section className="reveal lg:col-span-6" style={at(0)}>
          <p className="eyebrow">The quote</p>
          <h1 className="font-display text-6xl lg:text-7xl leading-none mt-2">Budget</h1>
          <label className="block mt-10 max-w-md">
            <span className="eyebrow">Total budget</span>
            <input defaultValue={project.budget ? money(project.budget, !Number.isInteger(Number(project.budget))) : ''} key={`b-${project.budget}`} inputMode="decimal" placeholder="$0"
              onBlur={e => toNumber(e.target.value) !== Number(project.budget) && saveProject({ budget: toNumber(e.target.value) })}
              className="field !text-5xl font-display num !py-1" aria-label="Total budget" />
          </label>
          <dl className="mt-8 grid grid-cols-3 gap-6 max-w-lg text-sm">
            <div><dt className="text-ink-3">Spent</dt><dd className="num text-lg mt-1">{money(spent)}</dd></div>
            <div><dt className="text-ink-3">Given to categories</dt><dd className="num text-lg mt-1">{money(allocated)}</dd></div>
            <div><dt className="text-ink-3">Not yet given out</dt><dd className={`num text-lg mt-1 ${project.budget - allocated < 0 ? 'text-accent' : ''}`}>{money(project.budget - allocated)}</dd></div>
          </dl>
          <p className="mt-8 text-sm text-ink-2 max-w-md">
            Have the builder&apos;s quote in a sheet? <Link href="/dashboard/import" className="text-accent underline underline-offset-4">Import it</Link> to fill
            every category budget at once{project.budget_sheet_url ? ' (it remembers your quote sheet)' : ''}.
          </p>
          <label className="block mt-8 max-w-md">
            <span className="eyebrow">Project name</span>
            <input defaultValue={project.name} key={`n-${project.name}`} onBlur={e => e.target.value.trim() && e.target.value !== project.name && saveProject({ name: e.target.value })} className="field" />
          </label>
        </section>

        <section className="reveal lg:col-span-6 lg:mt-24 bg-sand rounded-sm p-6 lg:p-8 self-start" style={at(1)}>
          <h2 className="font-display text-3xl">Bought by you vs the quote</h2>
          <p className="text-sm text-ink-2 mt-2">For each category where the owner paid for some of it, what was spent in total against the quote for that line.</p>
          {savings.length ? (
            <>
              <p className="mt-6">
                <span className={`num font-display text-5xl ${totalSaved >= 0 ? '' : 'text-accent'}`}>{money(Math.abs(totalSaved))}</span>
                <span className="ml-2 text-ink-2">{totalSaved >= 0 ? 'under' : 'over'} the quote overall</span>
              </p>
              <table className="ledger mt-6">
                <thead><tr><th>Category</th><th className="!text-right">Quote</th><th className="!text-right">Spent</th><th className="!text-right">Difference</th></tr></thead>
                <tbody>
                  {savings.map(s => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td className="text-right num text-ink-2">{money(s.budget)}</td>
                      <td className="text-right num">{money(s.spent)}</td>
                      <td className={`text-right num font-medium ${s.saved < 0 ? 'text-accent' : ''}`}>{s.saved >= 0 ? '−' : '+'}{money(Math.abs(s.saved))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="mt-6 text-ink-3 italic">Shows up once categories have budgets and some owner-paid expenses.</p>
          )}
        </section>
      </div>

      <section className="reveal mt-16" style={at(2)}>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-4xl">Categories</h2>
          <form onSubmit={addCategory} className="flex items-end gap-3 w-full sm:w-auto">
            <label className="flex-1 sm:w-64 block">
              <span className="sr-only">New category name</span>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New category" className="field" />
            </label>
            <button className="btn-ink">Add</button>
          </form>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="ledger">
            <thead>
              <tr>
                <th>Category</th>
                <th className="!text-right">Spent</th>
                <th className="!text-right">Budget</th>
                <th className="w-56">Used</th>
                <th className="w-16"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const s = spentOf(c);
                const used = c.budget > 0 ? s / Number(c.budget) : 0;
                return (
                  <tr key={c.id} className="group">
                    <td className="!py-1.5">
                      <input defaultValue={c.name} key={`cn-${c.id}-${c.name}`} onBlur={e => e.target.value.trim() && e.target.value !== c.name && saveCategory(c.id, { name: e.target.value })}
                        className="field !border-transparent hover:!border-ink/20 focus:!border-accent" aria-label="Category name" />
                    </td>
                    <td className="text-right whitespace-nowrap num !py-3.5">{money(s)} <span className="text-xs text-ink-3">· {c.expense_count}</span></td>
                    <td className="text-right !py-1.5">
                      <input defaultValue={c.budget ? Number(c.budget) : ''} key={`cb-${c.id}-${c.budget}`} inputMode="decimal" placeholder="—"
                        onBlur={e => toNumber(e.target.value) !== Number(c.budget) && saveCategory(c.id, { budget: toNumber(e.target.value) })}
                        className="field !w-28 ml-auto text-right num" aria-label={`Budget for ${c.name}`} />
                    </td>
                    <td className="!py-4">
                      {c.budget > 0 && (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full bg-ink/[0.07] overflow-hidden">
                            <div className={`h-full rounded-full ${used > 1 ? 'bg-accent' : 'bg-ink'}`} style={{ width: `${Math.min(used, 1) * 100}%` }} />
                          </div>
                          <span className={`num text-xs w-10 text-right ${used > 1 ? 'text-accent font-medium' : 'text-ink-3'}`}>{pct(s, Number(c.budget))}</span>
                        </div>
                      )}
                    </td>
                    <td className="text-right !py-3.5">
                      <button onClick={() => deleteCategory(c)} className="text-xs text-ink-3 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-accent transition-opacity">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink">
                <td className="py-3 font-medium">Total</td>
                <td className="py-3 px-3 text-right num font-medium">{money(spent)}</td>
                <td className="py-3 px-3 text-right num font-medium">{money(allocated)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-4 text-xs text-ink-3">Changes save when you leave a field. Payments split across categories count toward each one.</p>
      </section>
    </div>
  );
}
