'use client';

import type React from 'react';
import { Home, MessageCircle, FileText } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { NavItem } from '@/types/components';

export function Footer() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      icon: <Home className="h-6 w-6" />,
      label: 'マイホーム',
      href: '/',
    },
    {
      icon: <FileText className="h-6 w-6" />,
      label: '事業者情報',
      href: '/business-info',
    },
    {
      icon: <MessageCircle className="h-6 w-6" />,
      label: 'チャット',
      href: '/chat',
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
