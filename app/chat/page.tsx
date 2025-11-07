'use client';
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatClient from './ChatClient';

const ChatPageContent = () => {
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
};

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageContent />
    </Suspense>
  );
}
