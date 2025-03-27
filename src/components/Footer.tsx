'use client';

import type React from 'react';
import { Home, MessageCircle, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

export function Footer() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      icon: <Home className="h-6 w-6" />,
      label: 'ホーム',
      href: '/',
    },
    {
      icon: <MessageCircle className="h-6 w-6" />,
      label: 'チャット',
      href: '/chat',
    },
    {
      icon: <User className="h-6 w-6" />,
      label: 'マイページ',
      href: '/mypage',
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-background border-t border-border shadow-lg">
      <nav className="flex items-center justify-around h-16">
        {navItems.map(item => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center justify-center w-full h-full"
          >
            <div
              className={cn(
                'flex flex-col items-center justify-center',
                pathname === item.href ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {item.icon}
              <span className="text-xs mt-1">{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>
    </div>
  );
}
