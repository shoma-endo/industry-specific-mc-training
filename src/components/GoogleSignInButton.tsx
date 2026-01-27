'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

interface GoogleSignInButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  asChild?: boolean;
  href?: string;
}

function GoogleLogo() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M17.64 9.2045C17.64 8.56637 17.5827 7.9527 17.4764 7.36359H9V10.8458H13.8436C13.635 11.9708 13.0009 12.9234 12.0483 13.5615V15.8195H14.9564C16.6582 14.2527 17.64 11.945 17.64 9.2045Z"
        fill="#4285F4"
      />
      <path
        d="M8.99998 18C11.43 18 13.4672 17.1943 14.9563 15.8195L12.0482 13.5616C11.2424 14.1016 10.2109 14.4202 8.99998 14.4202C6.65585 14.4202 4.67105 12.8379 3.96447 10.71H0.957397V13.0412C2.43861 15.9834 5.48157 18 8.99998 18Z"
        fill="#34A853"
      />
      <path
        d="M3.96448 10.71C3.78448 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78448 7.83 3.96448 7.29V4.95886H0.957402C0.347727 6.17386 0 7.54864 0 9C0 10.4514 0.347727 11.8261 0.957402 13.0411L3.96448 10.71Z"
        fill="#FBBC05"
      />
      <path
        d="M8.99998 3.57955C10.3213 3.57955 11.5072 4.03364 12.4486 4.92955L15.0227 2.35545C13.4631 0.910909 11.426 0 8.99998 0C5.48157 0 2.43861 2.01682 0.957397 4.95886L3.96447 7.29C4.67105 5.16205 6.65585 3.57955 8.99998 3.57955Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  label = 'Googleでログイン',
  className,
  asChild = false,
  type = 'button',
  children,
  href,
  onClick,
  ...props
}: GoogleSignInButtonProps) {
  const Comp = asChild ? Slot : 'button';
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !href) return;
    window.location.assign(href);
  };
  const resolvedOnClick = !asChild && href ? handleClick : onClick;

  return (
    <Comp
      {...(!asChild && { type })}
      onClick={resolvedOnClick}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'bg-white text-[#1F1F1F] text-[14px] leading-5 font-medium font-[\'Roboto\',sans-serif]',
        'border border-[#747775] shadow-[0_1px_1px_rgba(0,0,0,0.1)] hover:bg-[#f7f8f8]',
        'active:bg-[#f1f3f4] focus-visible:ring-[#4285f4]',
        'disabled:opacity-60 disabled:shadow-none disabled:cursor-not-allowed',
        'px-4 min-h-[40px]',
        className,
      )}
      {...props}
    >
      <span className="flex items-center gap-3">
        <span className="flex items-center justify-center rounded-sm bg-white">
          <GoogleLogo />
        </span>
        <span>{children ?? label}</span>
      </span>
    </Comp>
  );
}
