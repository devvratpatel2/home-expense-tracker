'use client';
import { useEffect, useState } from 'react';
import { useProjectId } from '@/lib/project-context';
import { CONSTRUCTION_PHASES } from '@/lib/constants';

interface ProgressUpdate {
  id: string; title: string; description: string; phase: string;
  status: string; image_path: string; date: string;
}

export default function ProgressPage() {
  const projectId = useProjectId();
  const [updates, setUpdates] = useState<ProgressUpdate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', phase: '', status: 'in_progress', date: new Date().toISOString().split('T')[0] });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    if (!projectId) return;
    fetch(`/api/progress?projectId=${projectId}`).then(r => r.json()).then(setUpdates);
  }

  useEffect(load, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let image_path = '';
    if (imageFile) {
      const fd = new FormData();
      fd.append('file', imageFile);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      image_path = data.path || '';
    }

    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, project_id: projectId, image_path }),
    });

    setForm({ title: '', description: '', phase: '', status: 'in_progress', date: new Date().toISOString().split('T')[0] });
    setImageFile(null);
    setShowForm(false);
    setSaving(false);
    load();
  }

  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    in_progress: 'bg-blue-100 text-blue-700',
    not_started: 'bg-gray-100 text-gray-600',
    delayed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Construction Progress</h2>
          <p className="text-gray-500">Track milestones and phases of your build</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          {showForm ? '✕ Cancel' : '+ Add Update'}
        </button>
      </div>

      {/* Phase Overview */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">Build Phases</h3>
        <div className="space-y-2">
          {CONSTRUCTION_PHASES.map((phase, i) => {
            const phaseUpdates = updates.filter(u => u.phase === phase);
            const isComplete = phaseUpdates.some(u => u.status === 'completed');
            const isActive = phaseUpdates.some(u => u.status === 'in_progress');
            return (
              <div key={phase} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete ? 'bg-green-500 text-white' : isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{isComplete ? '✓' : i + 1}</div>
                <span className={`text-sm ${isComplete ? 'text-green-700 font-medium' : isActive ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>{phase}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Update Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-700">New Progress Update</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Title *" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <select value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}
              className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Select Phase</option>
              {CONSTRUCTION_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              className="px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="delayed">Delayed</option>
            </select>
          </div>
          <textarea placeholder="Description / Notes" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
            className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          <div>
            <label className="text-sm text-gray-600 block mb-1">Photo (optional)</label>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium" />
          </div>
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
            {saving ? 'Saving...' : 'Save Update'}
          </button>
        </form>
      )}

      {/* Timeline */}
      <div className="space-y-4">
        {updates.map(update => (
          <div key={update.id} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-gray-800">{update.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  {update.phase && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{update.phase}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColors[update.status] || 'bg-gray-100'}`}>
                    {update.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-400">{update.date}</span>
                </div>
              </div>
            </div>
            {update.description && <p className="text-sm text-gray-600 mt-3">{update.description}</p>}
            {update.image_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={update.image_path} alt={update.title} className="mt-3 rounded-lg max-h-64 object-cover" />
            )}
          </div>
        ))}
        {updates.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">🏗️</p>
            <p>No progress updates yet. Document your build journey!</p>
          </div>
        )}
      </div>
    </div>
  );
}
