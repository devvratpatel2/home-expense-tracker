'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCanEdit, useProjectId } from '@/lib/project-context';
import { money, shortMoney, pct, monthLabel, longDate } from '@/lib/format';
import { at } from '@/lib/reveal';
import type { Issue } from '@/lib/insights';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface DashboardData {
  projectName: string;
  totalSpent: number;
  budget: number;
  expenseCount: number;
  excluded: { count: number; total: number };
  remaining: number;
  firstDate: string;
  lastDate: string;
  byPaidBy: { Owner: number; Builder: number; Unassigned: number };
  byCategory: { name: string; total: number; owner: number; builder: number; count: number; budget: number }[];
  ownerSavings: { name: string; budget: number; spent: number; saved: number }[];
  quote: { lines: number; spent: number; overLines: number; outside: { name: string; total: number }[] };
  monthly: { month: string; Owner: number; Builder: number; Unassigned: number; cumulative: number }[];
  topVendors: { name: string; total: number; count: number }[];
  recentExpenses: { id: string; description: string; amount: number; date: string; category_name: string; paid_by: string }[];
  missing: { category: number; vendor: number; paidBy: number };
  issues: Issue[];
}

const INK = '#1E1A15';
const ACCENT = '#D8431A';
const CLAY = '#B9A486';
const axis = { fontSize: 11, fill: '#8C8273', fontFamily: 'var(--font-ui)' };
const tooltipStyle = { background: INK, border: 'none', borderRadius: 4, color: '#F3EEE5', fontSize: 12, fontFamily: 'var(--font-ui)' };

export default function DashboardPage() {
  const projectId = useProjectId();
  const canEdit = useCanEdit();
  const [data, setData] = useState<DashboardData | null>(null);
  const [allCategories, setAllCategories] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/dashboard?projectId=${projectId}`).then(r => r.json()).then(setData);
  }, [projectId]);

  if (!data) return <p className="font-display italic text-2xl text-ink-3">Adding it all up…</p>;

  if (data.expenseCount + data.excluded.count === 0) {
    return (
      <div className="max-w-3xl lg:ml-[10%] lg:mt-24">
        <h1 className="reveal font-display text-6xl lg:text-7xl leading-[0.95]" style={at(0)}>
          Nothing in the <span className="italic">ledger</span> yet.
        </h1>
        {canEdit && <p className="reveal mt-6 text-ink-2 max-w-md" style={at(1)}>
          Bring your sheet in from the <Link href="/dashboard/import" className="text-accent underline underline-offset-4">Import</Link> page, or start adding payments on <Link href="/dashboard/expenses" className="text-accent underline underline-offset-4">Expenses</Link>.
        </p>}
      </div>
    );
  }

  const { totalSpent, budget, byPaidBy } = data;
  const over = budget > 0 && totalSpent > budget;
  const crossed = budget > 0 ? data.monthly.find(m => m.cumulative > budget) : undefined;
  const scale = Math.max(totalSpent, budget);
  const categories = allCategories ? data.byCategory : data.byCategory.slice(0, 12);
  const maxCategory = Math.max(...data.byCategory.map(c => Math.max(c.total, c.budget)), 1);
  const ownerSaved = data.ownerSavings.reduce((s, c) => s + c.saved, 0);
  const missingCount = data.missing.category + data.missing.vendor + data.missing.paidBy;

  return (
    <div className="max-w-[1320px]">
      <header className="reveal flex flex-wrap items-baseline gap-x-6 gap-y-1" style={at(0)}>
        <p className="eyebrow">{data.projectName || 'Overview'}</p>
        <p className="text-sm text-ink-3">
          {data.expenseCount} payments · {longDate(data.firstDate)} to {longDate(data.lastDate)}
          {data.excluded.count > 0 && <> · <Link href="/dashboard/expenses" className="hover:text-ink underline underline-offset-4 decoration-ink/20">{money(data.excluded.total)} in {data.excluded.count} left out</Link></>}
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-12">
        {/* Headline number */}
        <section className="reveal lg:col-span-7" style={at(1)}>
          <p className="eyebrow">Spent to date</p>
          <p className="num font-display leading-[0.85] tracking-tight text-[clamp(3.75rem,10vw,8.5rem)] mt-3">{money(totalSpent)}</p>
          {budget > 0 ? (
            <>
              <p className="mt-5 text-lg text-ink-2 max-w-xl">
                against a {money(budget)} budget, which is{' '}
                {over ? <span className="text-accent font-medium">{money(totalSpent - budget)} over</span> : <span className="text-ink font-medium">{money(budget - totalSpent)} left</span>}
                {crossed && <> since {monthLabel(crossed.month)}</>}.
              </p>
              <div className="mt-6 flex h-2.5 w-full max-w-xl overflow-hidden rounded-full bg-dune" role="img" aria-label={`${pct(totalSpent, budget)} of budget used`}>
                <div className="bg-ink" style={{ width: `${(Math.min(totalSpent, budget) / scale) * 100}%` }} />
                {over && <div className="bg-accent" style={{ width: `${((totalSpent - budget) / scale) * 100}%` }} />}
              </div>
              <p className="mt-2 text-xs text-ink-3 num">{pct(totalSpent, budget)} of budget</p>
              {data.quote.lines > 0 && data.quote.outside.length > 0 && (
                <div className="mt-8 grid grid-cols-2 gap-6 max-w-xl text-sm">
                  <div>
                    <p className="text-ink-3">Under a quote line</p>
                    <p className="num font-display text-3xl mt-1">{money(data.quote.spent)}</p>
                    <p className="text-xs text-ink-3 mt-1">{data.quote.lines} lines{data.quote.overLines > 0 && <>, <span className="text-accent">{data.quote.overLines} over</span></>}</p>
                  </div>
                  <div>
                    <p className="text-ink-3">Not in the quote</p>
                    <p className="num font-display text-3xl mt-1">{money(totalSpent - data.quote.spent)}</p>
                    <p className="text-xs text-ink-3 mt-1 line-clamp-2">{data.quote.outside.slice(0, 4).map(c => c.name).join(', ')}{data.quote.outside.length > 4 ? ` and ${data.quote.outside.length - 4} more` : ''}</p>
                  </div>
                </div>
              )}
            </>
          ) : canEdit && (
            <p className="mt-5 text-ink-2">
              No budget yet. <Link href="/dashboard/budget" className="text-accent underline underline-offset-4">Set one</Link> or import the builder&apos;s quote sheet.
            </p>
          )}
        </section>

        {/* Who paid */}
        <section className="reveal lg:col-span-5 lg:mt-14 bg-ink text-paper rounded-sm p-7 lg:p-9" style={at(2)}>
          <p className="eyebrow !text-paper/50">Who paid</p>
          <div className="mt-6 grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-accent-soft flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" />Owner</p>
              <p className="num font-display text-4xl lg:text-5xl mt-1">{shortMoney(byPaidBy.Owner)}</p>
              <p className="text-xs text-paper/50 num mt-1">{pct(byPaidBy.Owner, totalSpent)}</p>
            </div>
            <div>
              <p className="text-sm text-paper/70 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-paper/70" />Builder</p>
              <p className="num font-display text-4xl lg:text-5xl mt-1">{shortMoney(byPaidBy.Builder)}</p>
              <p className="text-xs text-paper/50 num mt-1">{pct(byPaidBy.Builder, totalSpent)}</p>
            </div>
          </div>
          <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-paper/10">
            <div className="bg-accent" style={{ width: pct(byPaidBy.Owner, totalSpent) }} />
            <div className="bg-paper/70" style={{ width: pct(byPaidBy.Builder, totalSpent) }} />
          </div>
          {byPaidBy.Unassigned > 0 && <p className="mt-3 text-xs text-paper/50">{money(byPaidBy.Unassigned)} has no payer set.</p>}
          {data.ownerSavings.length > 0 && (
            <div className="mt-8 pt-6 border-t border-paper/10">
              <p className="text-sm text-paper/70">Categories where you bought materials yourself</p>
              <p className="mt-1">
                <span className={`num font-display text-3xl ${ownerSaved >= 0 ? 'text-paper' : 'text-accent'}`}>{money(Math.abs(ownerSaved))}</span>{' '}
                <span className="text-sm text-paper/70">{ownerSaved >= 0 ? 'under' : 'over'} the quote across {data.ownerSavings.length}</span>
              </p>
            </div>
          )}
        </section>

        {/* Burn-up */}
        <section className="reveal lg:col-span-8 bg-sand rounded-sm p-5 sm:p-7" style={at(3)}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-3xl">Running total</h2>
            {budget > 0 && <p className="text-xs text-ink-3"><span className="inline-block w-4 border-t-2 border-dashed border-accent align-middle mr-2" />budget {shortMoney(budget)}</p>}
          </div>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthly} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="burn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INK} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={INK} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={INK} strokeOpacity={0.08} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tickFormatter={shortMoney} tick={axis} axisLine={false} tickLine={false} width={52} domain={[0, (max: number) => Math.max(max, budget) * 1.06]} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={l => monthLabel(String(l))} formatter={v => [money(Number(v)), 'Spent to date']} />
                {budget > 0 && <ReferenceLine y={budget} stroke={ACCENT} strokeDasharray="5 5" strokeWidth={1.5} />}
                <Area type="monotone" dataKey="cumulative" stroke={INK} strokeWidth={2} fill="url(#burn)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Needs a look */}
        <section className="reveal lg:col-span-4 lg:pt-6" style={at(4)}>
          <h2 className="font-display text-3xl">Needs a look</h2>
          {data.issues.length === 0 && missingCount === 0 ? (
            <p className="mt-4 text-ink-2">Nothing stands out. Every payment has a category, a vendor and a payer.</p>
          ) : (
            <ol className="mt-5 space-y-5">
              {data.issues.slice(0, 6).map((issue, i) => (
                <li key={`${issue.kind}-${i}`} className="flex gap-4">
                  <span className="num font-display text-2xl leading-none text-accent w-6 shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-medium">{issue.title}{issue.amount > 0 && <span className="text-ink-3 font-normal num"> · {money(issue.amount)}</span>}</p>
                    <Link href={`/dashboard/expenses?q=${encodeURIComponent(issue.search)}`} className="text-sm text-ink-2 hover:text-accent break-words">{issue.detail} →</Link>
                  </div>
                </li>
              ))}
              {missingCount > 0 && (
                <li className="flex gap-4">
                  <span className="num font-display text-2xl leading-none text-accent w-6 shrink-0">{Math.min(data.issues.length, 6) + 1}</span>
                  <div className="text-sm text-ink-2">
                    <p className="font-medium text-ink text-base">Missing details</p>
                    {[[data.missing.category, 'without a category', 'category=none'], [data.missing.vendor, 'without a vendor', 'vendor=none'], [data.missing.paidBy, 'without a payer', 'paidBy=none']]
                      .filter(([n]) => Number(n) > 0)
                      .map(([n, label, query]) => (
                        <Link key={String(label)} href={`/dashboard/expenses?${query}`} className="block hover:text-accent">{n} {label} →</Link>
                      ))}
                  </div>
                </li>
              )}
            </ol>
          )}
        </section>

        {/* Categories */}
        <section className="reveal lg:col-span-7 lg:row-span-2" style={at(5)}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-3xl">Where it went</h2>
            {canEdit && <Link href="/dashboard/budget" className="text-sm text-ink-3 hover:text-accent">Category budgets →</Link>}
          </div>
          <ul className="mt-6 space-y-3.5">
            {categories.map(c => {
              const overCat = c.budget > 0 && c.total > c.budget;
              return (
                <li key={c.name}>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="truncate text-ink">{c.name}</span>
                    <span className="num whitespace-nowrap">
                      <span className={overCat ? 'text-accent font-medium' : 'text-ink'}>{money(c.total)}</span>
                      {c.budget > 0 && <span className="text-ink-3"> / {shortMoney(c.budget)}</span>}
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-ink/[0.07]">
                    <div className={`absolute inset-y-0 left-0 rounded-full ${overCat ? 'bg-accent' : 'bg-ink'}`} style={{ width: `${(c.total / maxCategory) * 100}%` }} />
                    {c.budget > 0 && <div className="absolute -top-1 -bottom-1 w-[2px] bg-ink-3" style={{ left: `${(c.budget / maxCategory) * 100}%` }} title={`Budget ${money(c.budget)}`} />}
                  </div>
                </li>
              );
            })}
          </ul>
          {data.byCategory.length > 12 && (
            <button onClick={() => setAllCategories(!allCategories)} className="mt-5 text-sm text-ink-2 underline underline-offset-4 decoration-ink/20 hover:text-accent">
              {allCategories ? 'Show the top 12' : `Show all ${data.byCategory.length} categories`}
            </button>
          )}
          <p className="mt-4 text-xs text-ink-3">The grey tick on a bar is that category&apos;s budget. Bars turn red past it.</p>
        </section>

        {/* Monthly by payer */}
        <section className="reveal lg:col-span-5 bg-dune/60 rounded-sm p-5 sm:p-7" style={at(6)}>
          <h2 className="font-display text-3xl">Month by month</h2>
          <p className="text-xs text-ink-3 mt-1">
            <span className="inline-block h-2 w-2 rounded-full bg-accent mr-1.5" />Owner
            <span className="inline-block h-2 w-2 rounded-full bg-ink ml-4 mr-1.5" />Builder
          </p>
          <div className="mt-4 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={INK} strokeOpacity={0.08} />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={axis} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tickFormatter={shortMoney} tick={axis} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: INK, fillOpacity: 0.05 }} labelFormatter={l => monthLabel(String(l))} formatter={v => money(Number(v))} />
                <Bar dataKey="Owner" stackId="p" fill={ACCENT} isAnimationActive={false} />
                <Bar dataKey="Builder" stackId="p" fill={INK} isAnimationActive={false} />
                {byPaidBy.Unassigned > 0 && <Bar dataKey="Unassigned" stackId="p" fill={CLAY} isAnimationActive={false} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Vendors */}
        <section className="reveal lg:col-span-5 lg:pl-7" style={at(7)}>
          <h2 className="font-display text-3xl">Paid to</h2>
          <ol className="mt-5 space-y-2.5">
            {data.topVendors.map((v, i) => (
              <li key={v.name} className="flex items-baseline gap-3 text-sm">
                <span className="num text-[11px] text-ink-3 w-5">{String(i + 1).padStart(2, '0')}</span>
                <Link href={v.name === '(no vendor)' ? '/dashboard/expenses?vendor=none' : `/dashboard/expenses?q=${encodeURIComponent(v.name)}`}
                  className={`flex-1 truncate hover:text-accent ${v.name === '(no vendor)' ? 'italic text-ink-3' : ''}`}>
                  {v.name === '(no vendor)' ? 'No vendor recorded' : v.name}
                </Link>
                <span className="text-ink-3 text-xs num">{v.count}×</span>
                <span className="num w-24 text-right">{money(v.total)}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Latest */}
        <section className="reveal lg:col-span-12 grid lg:grid-cols-12 gap-x-10 gap-y-4 bg-sand/60 rounded-sm p-5 sm:p-7 lg:p-9" style={at(8)}>
          <div className="lg:col-span-4">
            <h2 className="font-display text-4xl leading-none">Latest <span className="italic">entries</span></h2>
            <Link href="/dashboard/expenses" className="inline-block mt-4 text-sm text-ink-2 hover:text-accent">The full ledger →</Link>
          </div>
          <ul className="lg:col-span-8 divide-y divide-ink/10">
            {data.recentExpenses.map(e => (
              <li key={e.id} className="flex items-baseline gap-4 py-3 first:pt-0">
                <span className="num text-xs text-ink-3 w-24 shrink-0">{longDate(e.date)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{e.description}</span>
                  <span className="text-xs text-ink-3">{e.category_name || 'Uncategorized'}{e.paid_by && <> · <span className={e.paid_by === 'Owner' ? 'text-accent' : ''}>{e.paid_by}</span></>}</span>
                </span>
                <span className="num">{money(e.amount, true)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
