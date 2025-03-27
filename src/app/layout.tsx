'use client';

import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { LiffProvider, useLiffContext } from '@/components/LiffProvider';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Home, CreditCard, User } from 'lucide-react';
import { usePathname } from 'next/navigation';

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
  const { profile, isLoggedIn, login, isLoading } = useLiffContext();
  const pathname = usePathname();

  // 現在のパスがメニュー項目のパスと一致するかチェック
  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-blue-500 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">LINE Demo App</h1>
          </div>
          <div className="flex items-center">
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

      <main className="flex-1 pb-20">{children}</main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <nav className="container mx-auto px-2">
          <ul className="flex justify-around text-center py-2">
            <li className="flex-1">
              <Link
                href="/"
                className={`flex flex-col items-center py-1 px-3 ${
                  isActive('/')
                    ? 'text-blue-600 font-medium footer-tab-active'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
              >
                <Home size={22} strokeWidth={isActive('/') ? 2.5 : 2} />
                <span className="text-xs mt-0.5 font-medium">ホーム</span>
              </Link>
            </li>
            <li className="flex-1">
              <Link
                href="/subscription"
                className={`flex flex-col items-center py-1 px-3 ${
                  isActive('/subscription')
                    ? 'text-blue-600 font-medium footer-tab-active'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
              >
                <CreditCard size={22} strokeWidth={isActive('/subscription') ? 2.5 : 2} />
                <span className="text-xs mt-0.5 font-medium">サブスク</span>
              </Link>
            </li>
            <li className="flex-1">
              <Link
                href="/mypage"
                className={`flex flex-col items-center py-1 px-3 ${
                  isActive('/mypage')
                    ? 'text-blue-600 font-medium footer-tab-active'
                    : 'text-gray-600 hover:text-blue-500'
                }`}
              >
                <User size={22} strokeWidth={isActive('/mypage') ? 2.5 : 2} />
                <span className="text-xs mt-0.5 font-medium">マイページ</span>
              </Link>
            </li>
          </ul>
        </nav>
      </footer>
    </div>
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
