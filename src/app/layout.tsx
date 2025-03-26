'use client';

import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { LiffProvider, useLiffContext } from '@/components/LiffProvider';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

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
  const { profile, isLoggedIn, login, logout, isLoading } = useLiffContext();

  return (
    <>
      <header className="bg-blue-500 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">LINE Demo App</h1>
          </div>
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
            {isLoggedIn && profile ? (
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="border-2 border-white h-9 w-9 cursor-pointer">
                        <AvatarImage src={profile.pictureUrl} alt={profile.displayName} />
                        <AvatarFallback>{profile.displayName.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{profile.displayName}</p>
                      <p className="text-[10px] opacity-80">
                        LINE ID: {profile.userId.substring(0, 8)}...
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* <Button
                  variant="outline"
                  size="sm"
                  className="text-xs bg-white/10 hover:bg-white/20 text-white border-white/30"
                  onClick={logout}
                >
                  ログアウト
                </Button> */}
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="bg-white text-blue-600 hover:bg-white/90"
                onClick={login}
                disabled={isLoading}
              >
                ログイン
              </Button>
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
