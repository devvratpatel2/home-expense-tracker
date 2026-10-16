'use client';
import { useEffect, useState } from 'react';
import { useProjectId } from '@/lib/project-context';
import { longDate } from '@/lib/format';
import { at } from '@/lib/reveal';

interface Viewer { email: string; added: string; name: string | null }
interface Link { token: string; created_at: string; expires_at: string | null; last_opened_at: string | null }

// SQLite datetime('now') is UTC without a zone marker.
const utc = (t: string) => new Date(t.includes('T') ? t : `${t.replace(' ', 'T')}Z`);
const when = (t: string) => utc(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function SharePage() {
  const projectId = useProjectId();
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [site, setSite] = useState('');
  const [link, setLink] = useState<Link | null>(null);
  const [days, setDays] = useState<string>('30');
  const [linkCopied, setLinkCopied] = useState(false);

  function load() {
    if (!projectId) return;
    fetch(`/api/share?projectId=${projectId}`).then(r => r.json()).then(d => Array.isArray(d) && setViewers(d));
    fetch(`/api/share/link?projectId=${projectId}`).then(r => r.json()).then(d => setLink(d.link ?? null));
  }

  async function makeLink() {
    if (link && !confirm('Make a new link? The current one stops working straight away.')) return;
    await fetch('/api/share/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: projectId, days: days === 'never' ? null : Number(days) }) });
    load();
  }

  async function turnOff() {
    if (!confirm('Turn the link off? Anyone who has it loses access straight away.')) return;
    await fetch(`/api/share/link?projectId=${projectId}`, { method: 'DELETE' });
    load();
  }

  const linkUrl = link ? `${site}/s/${link.token}` : '';
  const linkExpired = !!link?.expires_at && utc(link.expires_at) < new Date();

  async function copyLink() {
    await navigator.clipboard.writeText(linkUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  useEffect(load, [projectId]);
  useEffect(() => setSite(window.location.origin), []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: projectId, email }) });
    setSaving(false);
    if (!res.ok) { setError((await res.json()).error || 'Could not share'); return; }
    setEmail('');
    load();
  }

  async function remove(v: Viewer) {
    if (!confirm(`Stop sharing with ${v.email}? They lose access straight away.`)) return;
    await fetch(`/api/share?projectId=${projectId}&email=${encodeURIComponent(v.email)}`, { method: 'DELETE' });
    load();
  }

  const message = (v: Viewer) => v.name
    ? `I shared the house build with you. Sign in at ${site} with ${v.email} to see it.`
    : `I shared the house build with you. Go to ${site}, choose "Create account" and sign up with ${v.email}. No invite code needed.`;

  async function copy(v: Viewer) {
    await navigator.clipboard.writeText(message(v));
    setCopied(v.email);
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <div className="max-w-[1320px] grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <header className="reveal lg:col-span-5" style={at(0)}>
        <p className="eyebrow">Keep them in the loop</p>
        <h1 className="font-display text-6xl lg:text-7xl leading-none mt-2">Share</h1>
        <p className="mt-6 text-ink-2 leading-relaxed max-w-md">
          Two ways to let someone follow along. Neither lets them change anything.
        </p>
        <p className="mt-4 text-ink-2 leading-relaxed max-w-md">
          A link is quickest, but it works for anyone who gets hold of it, so it only shows the list of payments. A login shows more, and only to the person you named.
        </p>
      </header>

      <div className="lg:col-span-7 lg:pt-24">
        <section className="reveal bg-ink text-paper rounded-sm p-6 lg:p-8" style={at(1)}>
          <h2 className="font-display text-3xl">A link to the expenses</h2>
          <p className="mt-2 text-sm text-paper/60 max-w-lg">
            Anyone with the link sees the list of payments (date, description, category, vendor, who paid, amount) and nothing else. No receipts, notes, budget or photos, and no login needed. They can&apos;t change anything.
          </p>
          {link ? (
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-3">
                <input readOnly value={linkUrl} onFocus={e => e.target.select()} aria-label="Share link"
                  className={`field flex-1 min-w-[16rem] !text-paper !border-paper/25 num text-xs ${linkExpired ? 'line-through opacity-50' : ''}`} />
                <button onClick={copyLink} disabled={linkExpired} className="btn-accent">{linkCopied ? 'Copied' : 'Copy link'}</button>
              </div>
              <p className="mt-3 text-xs text-paper/60">
                {linkExpired ? <span className="text-accent-soft">Expired {when(link.expires_at!)}. </span> : link.expires_at ? `Works until ${when(link.expires_at)}. ` : 'Never expires. '}
                {link.last_opened_at ? `Last opened ${when(link.last_opened_at)}.` : 'Not opened yet.'}
              </p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-paper/60">No link right now.</p>
          )}
          <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-3">
            <label className="block">
              <span className="eyebrow !text-paper/50">{link ? 'New link lasts' : 'Link lasts'}</span>
              <select value={days} onChange={e => setDays(e.target.value)} className="field !text-paper !border-paper/25 [&_option]:text-ink">
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="never">No expiry</option>
              </select>
            </label>
            <button onClick={makeLink} className={link ? 'btn-quiet !text-paper hover:!bg-paper/10' : 'btn-accent'}>{link ? 'Make a new link' : 'Create a link'}</button>
            {link && <button onClick={turnOff} className="btn-quiet !text-accent-soft hover:!bg-paper/10">Turn it off</button>}
          </div>
        </section>

        <h2 className="reveal font-display text-3xl mt-14" style={at(2)}>Or give someone a login</h2>
        <p className="reveal mt-2 text-sm text-ink-2 max-w-lg" style={at(2)}>They see the overview, receipts and progress updates too, and you can remove them by name.</p>
        <form onSubmit={add} className="reveal mt-5 bg-sand rounded-sm p-6 lg:p-8 flex flex-wrap items-end gap-x-6 gap-y-4" style={at(3)}>
          <label className="block flex-1 min-w-[16rem]">
            <span className="eyebrow">Their email</span>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off"
              className="field text-base" />
          </label>
          <button type="submit" disabled={saving} className="btn-ink">{saving ? 'Sharing…' : 'Give them a login'}</button>
          {error && <p role="alert" className="basis-full text-sm text-accent-deep">{error}</p>}
        </form>

        <section className="reveal mt-10" style={at(4)}>
          <h3 className="eyebrow">People with a login</h3>
          {viewers.length === 0 ? (
            <p className="mt-3 font-display italic text-2xl text-ink-3">Only you, for now.</p>
          ) : (
            <ul className="mt-5 divide-y divide-ink/10">
              {viewers.map(v => (
                <li key={v.email} className="py-5 grid sm:grid-cols-12 gap-x-6 gap-y-2 items-baseline">
                  <div className="sm:col-span-7 min-w-0">
                    <p className="truncate">{v.name ? <>{v.name} <span className="text-ink-3">· {v.email}</span></> : v.email}</p>
                    <p className="text-xs text-ink-3 mt-0.5">
                      {v.name ? 'Has an account' : <span className="text-accent">Hasn&apos;t signed up yet</span>} · added {longDate(String(v.added).slice(0, 10))}
                    </p>
                  </div>
                  <div className="sm:col-span-5 flex sm:justify-end gap-1">
                    <button onClick={() => copy(v)} className="btn-quiet">{copied === v.email ? 'Copied' : 'Copy message'}</button>
                    <button onClick={() => remove(v)} className="btn-quiet !text-accent-deep hover:!bg-accent-soft/50">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {viewers.length > 0 && (
            <p className="mt-6 text-xs text-ink-3 max-w-lg">&ldquo;Copy message&rdquo; copies a short note with the site link and the email they should sign up with. Send it however you like.</p>
          )}
        </section>
      </div>
    </div>
  );
}
