'use client';
import { useEffect, useState } from 'react';
import { useCanEdit, useProjectId } from '@/lib/project-context';
import { CONSTRUCTION_PHASES } from '@/lib/constants';
import { uploadFile } from '@/lib/upload-client';
import { longDate } from '@/lib/format';
import { at } from '@/lib/reveal';

interface ProgressUpdate {
  id: string; title: string; description: string; phase: string;
  status: string; image_path: string; date: string;
}

const STATUS_LABEL: Record<string, string> = { not_started: 'Not started', in_progress: 'In progress', completed: 'Done', delayed: 'Delayed' };
const blank = () => ({ title: '', description: '', phase: '', status: 'in_progress', date: new Date().toISOString().split('T')[0] });

export default function ProgressPage() {
  const projectId = useProjectId();
  const canEdit = useCanEdit();
  const [updates, setUpdates] = useState<ProgressUpdate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    if (!projectId) return;
    fetch(`/api/progress?projectId=${projectId}`).then(r => r.json()).then(setUpdates);
  }

  useEffect(load, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const image_path = imageFile ? await uploadFile(imageFile) : '';
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, project_id: projectId, image_path }),
      });
      setForm(blank());
      setImageFile(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  const phaseState = (phase: string) => {
    const list = updates.filter(u => u.phase === phase);
    if (list.some(u => u.status === 'completed')) return 'done';
    if (list.some(u => u.status === 'delayed')) return 'delayed';
    if (list.some(u => u.status === 'in_progress')) return 'active';
    return 'todo';
  };
  const doneCount = CONSTRUCTION_PHASES.filter(p => phaseState(p) === 'done').length;

  return (
    <div className="max-w-[1320px] grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <aside className="reveal lg:col-span-4 lg:sticky lg:top-12 self-start" style={at(0)}>
        <p className="eyebrow">On site</p>
        <h1 className="font-display text-6xl lg:text-7xl leading-none mt-2">Progress</h1>
        <p className="mt-4 text-ink-2"><span className="num font-display text-3xl text-ink">{doneCount}</span> of {CONSTRUCTION_PHASES.length} phases done</p>
        <ol className="mt-8 space-y-2.5">
          {CONSTRUCTION_PHASES.map((phase, i) => {
            const s = phaseState(phase);
            return (
              <li key={phase} className="flex items-baseline gap-3 text-sm">
                <span className={`num text-[11px] w-5 ${s === 'active' || s === 'delayed' ? 'text-accent' : 'text-ink-3'}`}>{String(i + 1).padStart(2, '0')}</span>
                <span className={s === 'done' ? 'line-through decoration-ink/30 text-ink-3' : s === 'todo' ? 'text-ink-2' : 'text-ink font-medium'}>{phase}</span>
                {s === 'active' && <span className="text-xs text-accent">now</span>}
                {s === 'delayed' && <span className="text-xs text-accent">delayed</span>}
              </li>
            );
          })}
        </ol>
      </aside>

      <div className="lg:col-span-8 lg:pt-28">
        {canEdit && (
          <div className="reveal flex justify-end" style={at(1)}>
            <button onClick={() => setShowForm(!showForm)} className={showForm ? 'btn-ink' : 'btn-accent'}>{showForm ? 'Close' : 'Post an update'}</button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-6 bg-sand rounded-sm p-6 grid sm:grid-cols-2 gap-x-6 gap-y-5">
            <label className="sm:col-span-2 block">
              <span className="eyebrow">Title</span>
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="field text-base" />
            </label>
            <label className="block">
              <span className="eyebrow">Phase</span>
              <select value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })} className="field">
                <option value="">—</option>
                {CONSTRUCTION_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-6">
              <label className="block">
                <span className="eyebrow">Status</span>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="field">
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="eyebrow">Date</span>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="field" />
              </label>
            </div>
            <label className="sm:col-span-2 block">
              <span className="eyebrow">Notes</span>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="field resize-y" />
            </label>
            <label className="block">
              <span className="eyebrow">Photo</span>
              <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)}
                className="mt-2 block w-full text-sm text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-1.5 file:text-ink" />
            </label>
            <div className="flex items-end justify-end gap-3">
              {error && <p role="alert" className="text-sm text-accent-deep">{error}</p>}
              <button type="submit" disabled={saving} className="btn-ink">{saving ? 'Saving…' : 'Save update'}</button>
            </div>
          </form>
        )}

        <ol className="reveal mt-10 space-y-14" style={at(2)}>
          {updates.map((u, i) => (
            <li key={u.id} className={`grid sm:grid-cols-12 gap-6 items-start ${i % 2 ? 'sm:pl-[8%]' : ''}`}>
              {u.image_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.image_path} alt={u.title} className={`sm:col-span-6 w-full rounded-sm object-cover aspect-[4/3] ${i % 2 ? 'sm:order-2' : ''}`} />
              )}
              <div className={u.image_path ? 'sm:col-span-6' : 'sm:col-span-9'}>
                <p className="text-xs text-ink-3 num">
                  {longDate(u.date)}{u.phase && <> · {u.phase}</>} · <span className={u.status === 'delayed' || u.status === 'in_progress' ? 'text-accent' : ''}>{STATUS_LABEL[u.status] || u.status}</span>
                </p>
                <h3 className="font-display text-3xl mt-1 leading-tight">{u.title}</h3>
                {u.description && <p className="mt-3 text-ink-2 leading-relaxed whitespace-pre-line">{u.description}</p>}
              </div>
            </li>
          ))}
        </ol>
        {updates.length === 0 && !showForm && (
          <p className="mt-10 font-display italic text-3xl text-ink-3 max-w-md">{canEdit ? 'No updates yet. Post the first photo from site.' : 'No updates posted yet.'}</p>
        )}
      </div>
    </div>
  );
}
