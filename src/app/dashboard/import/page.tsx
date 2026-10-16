'use client';
import { useState } from 'react';
import { useProjectId } from '@/lib/project-context';

export default function ImportPage() {
  const projectId = useProjectId();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ imported?: number; skipped?: number; createdCategories?: string[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !projectId) return;
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('projectId', projectId);

    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await res.json();
      setResult(data);
    } catch { setResult({ error: 'Import failed' }); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800">Import Data</h2>
      <p className="text-gray-500">Import expenses from a CSV or spreadsheet file. Export your Google Sheet as CSV first.</p>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">How to import from Google Sheets</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
          <li>Open your Google Sheet</li>
          <li>Go to File → Download → Comma Separated Values (.csv)</li>
          <li>Upload the downloaded CSV file below</li>
        </ol>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
          <p className="font-medium">Expected columns (flexible matching):</p>
          <p>Date, Amount, Description, Category, Vendor, Source (Owner/Builder), Notes</p>
          <p className="mt-1">Categories that don&apos;t exist yet are created. Rows already in the app are skipped, so re-importing the same sheet is safe.</p>
        </div>
      </div>

      <form onSubmit={handleImport} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Select CSV File</label>
          <input type="file" accept=".csv,.tsv,.txt" onChange={e => setFile(e.target.files?.[0] || null)} required
            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium" />
        </div>
        <button type="submit" disabled={loading || !file}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
          {loading ? 'Importing...' : 'Import Expenses'}
        </button>
      </form>

      {result && (
        <div className={`rounded-xl p-4 ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {result.error ? `Error: ${result.error}` : (
            <>
              <p>✅ Imported {result.imported} expenses{result.skipped ? `, skipped ${result.skipped} already in the app` : ''}.</p>
              {!!result.createdCategories?.length && <p className="text-sm mt-1">New categories: {result.createdCategories.join(', ')}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
