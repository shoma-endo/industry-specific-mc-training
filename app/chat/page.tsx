'use client';
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatClient from './ChatClient';
import { BLOG_STEP_IDS, type BlogStepId } from '@/lib/constants';

const ChatPageContent = () => {
  const searchParams = useSearchParams();
  const initialSessionId = searchParams?.get('session') ?? undefined;
  const rawInitialStep = searchParams?.get('initialStep');
  const initialStep = rawInitialStep && BLOG_STEP_IDS.includes(rawInitialStep as BlogStepId)
    ? (rawInitialStep as BlogStepId)
    : undefined;

  React.useEffect(() => {
    console.info('[ChatPage] Navigated to chat room');

    const onRestore = (e: Event) => {
      const ev = e as CustomEvent<{ step?: string; aiMessageId?: string }>;
      console.info('[ChatPage] Blog flow restored', ev.detail);
    };

    window.addEventListener('blogFlow:restored', onRestore);
    return () => window.removeEventListener('blogFlow:restored', onRestore);
  }, []);

  return (
    <ChatClient
      initialSessionId={initialSessionId ?? undefined}
      initialStep={initialStep}
    />
  );
};

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageContent />
    </Suspense>
  );
}
