'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { at } from '@/lib/reveal';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { email, password, name, inviteCode };

    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push('/dashboard');
    } catch { setError('Something went wrong'); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-12">
      <section className="lg:col-span-7 px-6 sm:px-12 lg:pl-20 pt-12 pb-16 flex flex-col">
        <p className="reveal eyebrow" style={at(0)}>Build Ledger</p>
        <div className="mt-auto max-w-2xl lg:ml-[8%]">
          <h1 className="reveal font-display text-[13vw] sm:text-7xl lg:text-[6.5rem] leading-[0.92] tracking-tight" style={at(1)}>
            Every dollar <br />
            <span className="italic text-ink-2">that went into</span> <br />
            the <span className="text-accent">house</span>.
          </h1>
          <p className="reveal mt-8 max-w-sm text-ink-2 leading-relaxed lg:ml-auto lg:mr-12" style={at(2)}>
            Owner and builder payments, the quote you&apos;re measured against, and the receipts behind them, kept in one ledger.
          </p>
        </div>
      </section>

      <section className="reveal lg:col-span-5 bg-sand px-6 sm:px-12 py-14 lg:py-0 flex items-center" style={at(3)}>
        <div className="w-full max-w-sm lg:mt-40">
          <div className="flex gap-6 mb-10 text-sm">
            {[['Sign in', true], ['Create account', false]].map(([label, value]) => (
              <button key={String(label)} onClick={() => { setIsLogin(value as boolean); setError(''); }}
                className={`pb-1 border-b-2 transition-colors ${isLogin === value ? 'border-accent text-ink font-medium' : 'border-transparent text-ink-3 hover:text-ink-2'}`}>
                {label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <label className="block">
                <span className="eyebrow">Name</span>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" className="field" />
              </label>
            )}
            <label className="block">
              <span className="eyebrow">Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className="field" />
            </label>
            <label className="block">
              <span className="eyebrow">Password</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={isLogin ? 'current-password' : 'new-password'} className="field" />
            </label>
            {!isLogin && (
              <label className="block">
                <span className="eyebrow">Invite code</span>
                <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Not needed if you were invited" className="field" />
              </label>
            )}
            {error && <p role="alert" className="text-sm text-accent-deep">{error}</p>}
            <button type="submit" disabled={loading} className="btn-ink w-full justify-center mt-4">
              {loading ? 'One moment…' : isLogin ? 'Open the ledger' : 'Create account'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
