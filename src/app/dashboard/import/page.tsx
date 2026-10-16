'use client';
import { useEffect, useState } from 'react';
import { useProjectId } from '@/lib/project-context';
import { money } from '@/lib/format';
import { at } from '@/lib/reveal';

type Kind = 'expenses' | 'budget';
interface Result {
  kind?: Kind; error?: string;
  imported?: number; skipped?: number; filled?: number; badDates?: number;
  budgetLines?: number; total?: number; createdCategories?: string[];
}
interface Project { id: string; sheet_url?: string; budget_sheet_url?: string }

export default function ImportPage() {
  const projectId = useProjectId();
  const [project, setProject] = useState<Project | null>(null);
  const [kind, setKind] = useState<Kind>('expenses');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<Kind>('expenses');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState('');

  function loadProject() {
    fetch('/api/projects').then(r => r.json()).then((ps: Project[]) => setProject(ps.find(p => p.id === projectId) || null));
  }
  useEffect(loadProject, [projectId]);

  const savedLink = kind === 'budget' ? project?.budget_sheet_url : project?.sheet_url;
  useEffect(() => setLink(savedLink || ''), [savedLink]);

  async function run(label: string, request: () => Promise<Response>) {
    setLoading(label);
    setResult(null);
    try {
      const res = await request();
      setResult(await res.json());
      loadProject();
    } catch {
      setResult({ error: 'Import failed. Check your connection and try again.' });
    } finally {
      setLoading('');
    }
  }

  function importLink(e: React.FormEvent) {
    e.preventDefault();
    run('link', () => fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, sheetUrl: link, kind }),
    }));
  }

  function importFile(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('projectId', projectId);
    fd.append('kind', fileKind);
    run('file', () => fetch('/api/import', { method: 'POST', body: fd }));
  }

  return (
    <div className="max-w-[1320px]">
      <header className="reveal" style={at(0)}>
        <p className="eyebrow">Bring it in</p>
        <h1 className="font-display text-6xl lg:text-7xl leading-none mt-2">Import</h1>
        <p className="mt-4 max-w-xl text-ink-2">
          The app only reads your sheet. It never writes to it. Anything already in the ledger is matched and skipped, so you can run this as often as you like.
        </p>
      </header>

      <div className="mt-12 grid lg:grid-cols-12 gap-x-12 gap-y-10">
        <form onSubmit={importLink} className="reveal lg:col-span-7" style={at(1)}>
          <h2 className="font-display text-4xl">From a Google Sheet</h2>
          <div className="mt-6 flex gap-2" role="radiogroup" aria-label="What the sheet holds">
            {([['expenses', 'Expenses'], ['budget', 'Builder’s quote']] as const).map(([value, label]) => (
              <button type="button" role="radio" aria-checked={kind === value} key={value} onClick={() => { setKind(value); setResult(null); }}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${kind === value ? 'bg-ink text-paper' : 'bg-sand text-ink-2 hover:bg-dune'}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="block mt-8">
            <span className="eyebrow">Sheet link</span>
            <input value={link} onChange={e => setLink(e.target.value)} required placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0" className="field text-base" />
          </label>
          <p className="mt-3 text-sm text-ink-3 max-w-lg">
            {kind === 'expenses'
              ? 'Columns: Date, Amount, Description, Category, Vendor, Source (Owner or Builder), Notes, Allocations.'
              : 'Item names in column A and costs in column B. Each line sets that category’s budget, and the total becomes the project budget.'}
            {' '}The sheet needs sharing set to “Anyone with the link can view”.
          </p>
          <button type="submit" disabled={!!loading || !link} className="btn-accent mt-8">
            {loading === 'link' ? 'Reading the sheet…' : savedLink && savedLink === link ? 'Sync again' : 'Import from link'}
          </button>
          {savedLink && <p className="mt-3 text-xs text-ink-3">This link is saved, so next time it&apos;s one click.</p>}
        </form>

        <form onSubmit={importFile} className="reveal lg:col-span-5 lg:mt-20 bg-sand rounded-sm p-6 lg:p-8 self-start" style={at(2)}>
          <h2 className="font-display text-3xl">Or upload a CSV</h2>
          <p className="mt-2 text-sm text-ink-2">For a private sheet: in Google Sheets choose File → Download → Comma-separated values, then pick the file here.</p>
          <label className="block mt-6">
            <span className="eyebrow">The file holds</span>
            <select value={fileKind} onChange={e => setFileKind(e.target.value as Kind)} className="field">
              <option value="expenses">Expenses</option>
              <option value="budget">Builder&apos;s quote</option>
            </select>
          </label>
          <label className="block mt-6">
            <span className="eyebrow">CSV file</span>
            <input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={e => setFile(e.target.files?.[0] || null)} required
              className="mt-2 block w-full text-sm text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-1.5 file:text-ink" />
          </label>
          <button type="submit" disabled={!!loading || !file} className="btn-ink mt-8">{loading === 'file' ? 'Importing…' : 'Import file'}</button>
        </form>
      </div>

      {result && (
        <section role="status" className={`mt-12 max-w-3xl rounded-sm p-6 ${result.error ? 'bg-accent-soft/70' : 'bg-ink text-paper'}`}>
          {result.error ? (
            <p className="text-accent-deep">{result.error}</p>
          ) : result.kind === 'budget' ? (
            <>
              <p className="font-display text-3xl">{result.budgetLines} budget lines, {money(result.total || 0)} in total.</p>
              {!!result.createdCategories?.length && <p className="mt-2 text-sm text-paper/70">New categories: {result.createdCategories.join(', ')}</p>}
            </>
          ) : (
            <>
              <p className="font-display text-3xl">
                {result.imported ? `${result.imported} new payments added.` : 'Nothing new to add.'}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-paper/70">
                {!!result.skipped && <li>{result.skipped} were already in the ledger.</li>}
                {!!result.filled && <li>{result.filled} existing entries got a missing category, vendor or payer filled in from the sheet.</li>}
                {!!result.badDates && <li className="text-accent-soft">{result.badDates} rows were skipped because their date couldn&apos;t be read.</li>}
                {!!result.createdCategories?.length && <li>New categories: {result.createdCategories.join(', ')}</li>}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
