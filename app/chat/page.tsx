'use client';
import React from 'react';
import ChatClient from './ChatClient';
import { useSearchParams } from 'next/navigation';

export default function ChatPage() {
  const searchParams = useSearchParams();
  const initialSessionId = searchParams.get('session');

  React.useEffect(() => {
    console.info('[ChatPage] Navigated to chat room');

    const onRestore = (e: Event) => {
      const ev = e as CustomEvent<{ step?: string; aiMessageId?: string }>;
      console.info('[ChatPage] Blog flow restored', ev.detail);
    };

    window.addEventListener('blogFlow:restored', onRestore);
    return () => window.removeEventListener('blogFlow:restored', onRestore);
  }, []);

  return <ChatClient initialSessionId={initialSessionId ?? undefined} />;
}
