'use client';

import { Geist } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/Footer';
import { LiffProvider } from '@/components/LiffProvider';

const geistSans = Geist({
  subsets: ['latin'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={geistSans.className}>
        <LiffProvider>
          <div className="flex flex-col min-h-screen">
            <main className="flex-1 pb-20">{children}</main>
            <Footer />
          </div>
        </LiffProvider>
      </body>
    </html>
  );
}
