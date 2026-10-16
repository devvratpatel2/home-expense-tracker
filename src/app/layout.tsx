import type { Metadata } from 'next';
import { Instrument_Serif, Space_Grotesk } from 'next/font/google';
import './globals.css';

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display' });
const ui = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-ui' });

export const metadata: Metadata = {
  title: 'Build Ledger',
  description: 'Every dollar that went into the house',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body className="font-sans bg-paper text-ink min-h-screen antialiased">{children}</body>
    </html>
  );
}
