'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
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
          toast.custom(
            t => (
              <div
                className="relative flex items-center gap-4 w-auto max-w-lg p-4 bg-amber-50 border border-amber-200 rounded-lg shadow-lg shadow-amber-900/5 cursor-pointer hover:bg-amber-100 transition-all duration-200 overflow-hidden"
                onClick={() => {
                  toast.dismiss(t);
                  router.push('/analytics');
                }}
              >
                {/* 左端のアクセントバー */}
                <div className="absolute inset-y-0 left-0 w-1 bg-amber-500" />

                <div className="flex-shrink-0 ml-2">
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white text-amber-600 shadow-sm ring-1 ring-amber-100">
                    <Bell className="h-5 w-5" />
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-900 whitespace-nowrap">
                    {result.count}件の改善提案があります
                  </p>
                  <p className="text-xs text-amber-700 mt-1 opacity-90 whitespace-nowrap">
                    クリックしてコンテンツ一覧で確認
                  </p>
                </div>

                <button
                  className="flex-shrink-0 px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-md shadow-sm transition-colors whitespace-nowrap"
                  onClick={e => {
                    e.stopPropagation();
                    toast.dismiss(t);
                    router.push('/analytics');
                  }}
                >
                  確認する
                </button>
              </div>
            ),
            {
              duration: 10000,
            }
          );
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
