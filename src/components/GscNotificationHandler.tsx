'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useLiffContext } from '@/components/LiffProvider';
import { useFaviconBadge } from '@/hooks/useFaviconBadge';
import { getUnreadSuggestionsCount } from '@/server/actions/gscNotification.actions';

const TOAST_SESSION_KEY = 'gsc_notification_toast_shown';

export function GscNotificationHandler() {
  const { isLoggedIn, isLoading } = useLiffContext();
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const toastShownRef = useRef(false);

  // Faviconバッジの更新
  useFaviconBadge(unreadCount);

  const fetchUnread = useCallback(async () => {
    if (!isLoggedIn || isLoading) return;

    try {
      const result = await getUnreadSuggestionsCount();
      setUnreadCount(result.count);

      // セッション中に一度だけトースト表示
      if (result.count > 0 && !toastShownRef.current) {
        const alreadyShown = sessionStorage.getItem(TOAST_SESSION_KEY);
        if (!alreadyShown) {
          toast.info(`${result.count}件の改善提案があります`, {
            description: 'クリックしてコンテンツ一覧で確認',
            duration: 10000,
            action: {
              label: '確認する',
              onClick: () => router.push('/analytics'),
            },
          });
          sessionStorage.setItem(TOAST_SESSION_KEY, 'true');
          toastShownRef.current = true;
        }
      }
    } catch (error) {
      console.error('Failed to fetch unread suggestions', error);
    }
  }, [isLoggedIn, isLoading, router]);

  // 初回マウント時と画面遷移時に再取得
  useEffect(() => {
    fetchUnread();
  }, [fetchUnread, pathname]);

  // ログアウト時にリセット
  useEffect(() => {
    if (!isLoggedIn && !isLoading) {
      setUnreadCount(0);
      toastShownRef.current = false;
      sessionStorage.removeItem(TOAST_SESSION_KEY);
    }
  }, [isLoggedIn, isLoading]);

  // このコンポーネントはUIを持たない（Faviconバッジとトーストのみ）
  return null;
}
