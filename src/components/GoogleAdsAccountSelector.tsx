'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { handleAsyncAction, type ServerActionResult } from '@/lib/async-handler';

interface GoogleAdsAccount {
  customerId: string;
  displayName: string;
}

interface GoogleAdsAccountSelectorProps {
  initialCustomerId: string | null;
  onAccountSelected?: (customerId: string) => void;
}

export function GoogleAdsAccountSelector({
  initialCustomerId,
  onAccountSelected,
}: GoogleAdsAccountSelectorProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const fetchAccounts = async () => {
    await handleAsyncAction(
      async (): Promise<ServerActionResult<GoogleAdsAccount[]>> => {
        const response = await fetch('/api/google-ads/accounts');
        if (!response.ok) {
          const error = await response.json();
          return {
            success: false,
            error: error.error || 'アカウント一覧の取得に失敗しました',
          };
        }
        const data = await response.json();
        return {
          success: true,
          data: data.accounts as GoogleAdsAccount[],
        };
      },
      {
        onSuccess: data => {
          setAccounts(data || []);
          if (!data || data.length === 0) {
            setAlertMessage('アクセス可能なアカウントが見つかりませんでした。');
          }
        },
        setLoading: setIsLoading,
        setMessage: setAlertMessage,
        defaultErrorMessage: 'アカウント一覧の取得に失敗しました',
      }
    );
  };

  const handleAccountChange = async (value: string) => {
    const previousCustomerId = selectedCustomerId;
    setSelectedCustomerId(value);
    setAlertMessage(null);

    await handleAsyncAction(
      async (): Promise<ServerActionResult<void>> => {
        const response = await fetch('/api/google-ads/accounts/select', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ customerId: value }),
        });

        if (!response.ok) {
          const error = await response.json();
          return {
            success: false,
            error: error.error || 'アカウント選択の保存に失敗しました',
          };
        }

        return {
          success: true,
        };
      },
      {
        onSuccess: () => {
          setAlertMessage('アカウントを保存しました');
          if (onAccountSelected) {
            onAccountSelected(value);
          } else {
            // ページをリロードして状態を更新
            setTimeout(() => {
              router.refresh();
            }, 1000);
          }
        },
        onError: () => {
          // 失敗時は元の選択状態に戻す
          setSelectedCustomerId(previousCustomerId ?? null);
        },
        setLoading: setIsSaving,
        setMessage: setAlertMessage,
        defaultErrorMessage: 'アカウント選択の保存に失敗しました',
      }
    );
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        アクセス可能なアカウントの中から、分析対象とするアカウントを選択してください。
      </p>
      <div className="space-y-2">
        <span className="text-sm font-medium text-gray-700">アカウント</span>
        <Select
          {...(selectedCustomerId ? { value: selectedCustomerId } : {})}
          onValueChange={(value) => {
            void handleAccountChange(value);
          }}
          disabled={isLoading || isSaving || accounts.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="アカウントを選択" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(account => (
              <SelectItem key={account.customerId} value={account.customerId}>
                <div className="flex flex-col">
                  <span>{account.displayName}</span>
                  <span className="text-xs text-gray-500">{account.customerId}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-gray-500">
          {isLoading && 'アカウント一覧を取得中です...'}
          {!isLoading && accounts.length === 0 && (
            <span>アクセス可能なアカウントが見つかりませんでした。</span>
          )}
        </div>
      </div>

      {selectedCustomerId && (
        <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-700 space-y-1">
          <div>
            <span className="font-medium">アカウントID:</span> {selectedCustomerId}
          </div>
        </div>
      )}

      {alertMessage && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            alertMessage.includes('失敗') ||
            alertMessage.includes('エラー') ||
            alertMessage.includes('関連付けられていません') ||
            alertMessage.includes('アカウントを作成') ||
            alertMessage.includes('アクセス権限を追加')
              ? 'border border-red-200 bg-red-50 text-red-900'
              : 'border border-green-200 bg-green-50 text-green-900'
          }`}
        >
          {alertMessage}
          {alertMessage.includes('関連付けられていません') && (
            <div className="mt-3 text-xs text-red-700">
              <p className="font-semibold mb-1">対処方法:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <a
                    href="https://ads.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-red-800"
                  >
                    Google Adsアカウントを作成
                  </a>
                  する
                </li>
                <li>
                  既存のGoogle Adsアカウントの「ユーザーとアクセス」から、このGoogleアカウントにアクセス権限を追加する
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <Button
          type="button"
          variant="outline"
          onClick={fetchAccounts}
          disabled={isLoading || isSaving}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          アカウント再取得
        </Button>
      </div>
    </div>
  );
}
