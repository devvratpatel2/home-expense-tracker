import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Build Ledger · Expenses',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
