'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProjectContext } from '@/lib/project-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/expenses', label: 'Expenses' },
  { href: '/dashboard/budget', label: 'Budget' },
  { href: '/dashboard/progress', label: 'Progress' },
  { href: '/dashboard/import', label: 'Import' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [mobileNav, setMobileNav] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) router.push('/');
      else setUser(d.user);
    });
    fetch('/api/projects').then(r => r.json()).then(p => {
      if (Array.isArray(p) && p.length) {
        setProjects(p);
        setProjectId(p[0].id);
      }
    });
  }, [router]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (!user) return <div className="min-h-screen grid place-items-center"><p className="font-display italic text-2xl text-ink-3">Opening the ledger…</p></div>;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="bg-sand lg:min-h-screen lg:sticky lg:top-0 lg:h-screen flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 lg:pt-10 lg:pb-12">
          <Link href="/dashboard" className="font-display text-[1.7rem] leading-none">
            Build <span className="italic text-accent">Ledger</span>
          </Link>
          <button onClick={() => setMobileNav(!mobileNav)} className="lg:hidden btn-quiet" aria-expanded={mobileNav} aria-controls="main-nav">
            {mobileNav ? 'Close' : 'Menu'}
          </button>
        </div>

        <div id="main-nav" className={`${mobileNav ? 'flex' : 'hidden'} lg:flex flex-col flex-1 px-6 pb-8`}>
          {projects.length > 1 && (
            <label className="block mb-8">
              <span className="eyebrow">Project</span>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} className="field">
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          <nav className="space-y-0.5" aria-label="Main">
            {NAV_ITEMS.map((item, i) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileNav(false)} aria-current={active ? 'page' : undefined}
                  className={`group flex items-baseline gap-3 py-2 text-[15px] transition-colors ${active ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}>
                  <span className={`num text-[11px] w-5 ${active ? 'text-accent' : 'text-ink-3'}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={active ? 'font-medium' : ''}>{item.label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent self-center" aria-hidden />}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto pt-10 text-sm">
            <p className="text-ink-3">Signed in as</p>
            <p className="text-ink">{user.name}</p>
            <button onClick={logout} className="mt-3 text-ink-3 hover:text-accent underline underline-offset-4 decoration-ink/20">Sign out</button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-5 sm:px-8 lg:px-14 py-8 lg:py-12">
        {projectId ? (
          <ProjectContext.Provider value={projectId}>{children}</ProjectContext.Provider>
        ) : (
          <p className="font-display text-3xl text-ink-2">No project yet.</p>
        )}
      </main>
    </div>
  );
}
