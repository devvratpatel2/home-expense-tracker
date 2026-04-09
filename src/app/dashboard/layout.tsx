'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProjectContext } from '@/lib/project-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/expenses', label: 'Expenses', icon: '💰' },
  { href: '/dashboard/progress', label: 'Progress', icon: '🏗️' },
  { href: '/dashboard/import', label: 'Import Data', icon: '📥' },
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

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">🏠 Home Build Tracker</h1>
        <button onClick={() => setMobileNav(!mobileNav)} className="p-2">☰</button>
      </div>
      <aside className={`${mobileNav ? 'block' : 'hidden'} md:block w-full md:w-64 bg-white border-r md:min-h-screen`}>
        <div className="p-6 hidden md:block">
          <h1 className="font-bold text-xl text-gray-800">🏠 Home Build Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome, {user.name}</p>
        </div>
        <div className="px-4 pb-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Project</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-gray-50">
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <nav className="px-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMobileNav(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                pathname === item.href ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <span>{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 mt-8">
          <button onClick={logout} className="w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-left">
            🚪 Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        {projectId ? (
          <ProjectContext.Provider value={projectId}>
            {children}
          </ProjectContext.Provider>
        ) : (
          <p className="text-gray-500">No project found. Create one to get started.</p>
        )}
      </main>
    </div>
  );
}
