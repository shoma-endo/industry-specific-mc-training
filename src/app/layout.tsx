'use client';

import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { LiffProvider, useLiffContext } from '@/components/LiffProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// metadataはクライアントコンポーネントでは使用できないため削除

function AppContent({ children }: { children: React.ReactNode }) {
  const { profile, isLoggedIn } = useLiffContext();

  return (
    <>
      <header className="bg-blue-500 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">LINE Demo App</h1>
          <div className="flex items-center">
            <nav className="mr-4">
              <ul className="flex space-x-4">
                <li>
                  <Link href="/" className="hover:underline">
                    ホーム
                  </Link>
                </li>
                <li>
                  <Link href="/subscription" className="hover:underline">
                    サブスクリプション
                  </Link>
                </li>
              </ul>
            </nav>
            {isLoggedIn && profile && (
              <div className="flex items-center gap-2">
                {profile.pictureUrl && (
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white">
                    <Image
                      src={profile.pictureUrl}
                      alt={profile.displayName}
                      width={32}
                      height={32}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      {children}
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <title>LINE ToDo App</title>
        <meta name="description" content="LIFFを使用したToDoアプリ" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LiffProvider>
          <AppContent>{children}</AppContent>
        </LiffProvider>
      </body>
    </html>
  );
}
