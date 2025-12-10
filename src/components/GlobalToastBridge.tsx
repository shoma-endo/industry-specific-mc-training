'use client';

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';

type DummyPayload = {
  id: string;
  evaluation_date: string;
  previous_position: number | null;
  current_position: number;
  outcome: string;
  suggestion_summary: string | null;
};

const LS_KEY = 'gsc_dummy_payload';
const TOAST_ID = 'GSC_DUMMY_SUGGESTION';

export function GlobalToastBridge() {
  const openDialog = (payload: DummyPayload) => {
    if (window.location.pathname.startsWith('/gsc-dashboard')) {
      window.dispatchEvent(new CustomEvent<DummyPayload>('gsc-dummy-open', { detail: payload }));
    } else {
      // ページ遷移してから開くため、ローカルストレージに残す
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      window.location.href = '/gsc-dashboard';
    }
    toast.dismiss(TOAST_ID);
    localStorage.removeItem(LS_KEY);
  };

  const showToast = useCallback((payload: DummyPayload) => {
    toast.dismiss(TOAST_ID);
    toast.custom(
      () => (
        <button
          type="button"
          onClick={() => openDialog(payload)}
          className="flex w-full flex-col items-start gap-1 rounded-md bg-white px-4 py-3 text-left shadow-lg ring-1 ring-gray-200 transition hover:bg-gray-50"
        >
          <span className="font-semibold text-gray-900">AI改善提案が届きました</span>
          <span className="text-sm text-gray-600">クリックして詳細を確認してください。</span>
        </button>
      ),
      {
        id: TOAST_ID,
        duration: Infinity,
        dismissible: true,
        onDismiss: () => {
          localStorage.removeItem(LS_KEY);
        },
      }
    );
  }, []);

  useEffect(() => {
    // 起動時に未処理のペイロードがあれば復元
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (raw) {
      try {
        const payload = JSON.parse(raw) as DummyPayload;
        showToast(payload);
      } catch {
        localStorage.removeItem(LS_KEY);
      }
    }

    // カスタムイベントで新規ペイロードを受信
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DummyPayload>).detail;
      if (detail) {
        localStorage.setItem(LS_KEY, JSON.stringify(detail));
        showToast(detail);
      }
    };
    window.addEventListener('gsc-dummy-update', handleUpdate);

    return () => {
      window.removeEventListener('gsc-dummy-update', handleUpdate);
    };
  }, [showToast]);

  return null;
}
