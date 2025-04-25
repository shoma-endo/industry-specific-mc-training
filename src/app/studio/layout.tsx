'use client';

import Link from 'next/link';
import { ScanSearch } from 'lucide-react';

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 p-6">{children}</main>
      <footer className="p-4 border-t text-right">
        <Link
          href="/landingPage"
          className="inline-flex items-center gap-2 text-green-600 hover:underline"
        >
          <ScanSearch className="h-5 w-5" />
          LPプレビューを見る
        </Link>
      </footer>
    </div>
  );
}
