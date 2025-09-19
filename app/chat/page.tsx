'use client';
import React from 'react';
import ChatClient from './ChatClientRefactored';

export default function ChatPage() {
  React.useEffect(() => {
    console.info('[ChatPage] Navigated to chat room');

    const onRestore = (e: Event) => {
      const ev = e as CustomEvent<{ step?: string; aiMessageId?: string }>;
      console.info('[ChatPage] Blog flow restored', ev.detail);
    };

    window.addEventListener('blogFlow:restored', onRestore);
    return () => window.removeEventListener('blogFlow:restored', onRestore);
  }, []);

  return <ChatClient />;
}
