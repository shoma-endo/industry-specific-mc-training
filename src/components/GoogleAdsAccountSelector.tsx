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
import { RefreshCw, ArrowRight } from 'lucide-react';
import { handleAsyncAction, type ServerActionResult } from '@/lib/async-handler';

interface GoogleAdsAccount {
  customerId: string;
  displayName: string;
  isManager: boolean;
}

interface GoogleAdsClientAccount {
  customerId: string;
  name: string;
  isManager: boolean;
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
  const [selectedAccount, setSelectedAccount] = useState<GoogleAdsAccount | null>(null);

  // マネージャーアカウント選択時の配下クライアントアカウント
  const [clientAccounts, setClientAccounts] = useState<GoogleAdsClientAccount[]>([]);
  const [selectedClientCustomerId, setSelectedClientCustomerId] = useState<string | null>(
    initialCustomerId
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isClientLoading, setIsClientLoading] = useState(false);
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
          const fetchedAccounts = data || [];
          setAccounts(fetchedAccounts);

          if (!fetchedAccounts || fetchedAccounts.length === 0) {
            setAlertMessage('アクセス可能なアカウントが見つかりませんでした。');
          } else {
            // 初期選択状態の復元
            // initialCustomerId がある場合、それがトップレベルアカウントリストにあるか確認
            const initialAccount = fetchedAccounts.find(a => a.customerId === initialCustomerId);
            if (initialAccount) {
              setSelectedAccount(initialAccount);
              // マネージャーでない場合は、そのアカウント自体が選択されたとみなす
              if (!initialAccount.isManager) {
                setSelectedClientCustomerId(initialCustomerId);
              } else if (initialCustomerId) {
                // マネージャーの場合は、クライアントリストを取得
                void fetchClientAccounts(initialCustomerId);
              }
            } else if (initialCustomerId) {
              // initialCustomerId があるがトップレベルにない場合（＝マネージャー配下の子アカウントが選択されている場合）
              // 親マネージャーが特定できないため、警告を表示せずに「未選択」状態とする手もあるが、
              // ここでは「現在選択中のアカウントID」としては有効なので selectedClientCustomerId には入れておく
              setSelectedClientCustomerId(initialCustomerId);
            }
          }
        },
        setLoading: setIsLoading,
        setMessage: setAlertMessage,
        defaultErrorMessage: 'アカウント一覧の取得に失敗しました',
      }
    );
  };

  const fetchClientAccounts = async (managerCustomerId: string) => {
    setClientAccounts([]);

    await handleAsyncAction(
      async (): Promise<ServerActionResult<GoogleAdsClientAccount[]>> => {
        const response = await fetch(
          `/api/google-ads/accounts/clients?managerCustomerId=${managerCustomerId}`
        );
        if (!response.ok) {
          const error = await response.json();
          return {
            success: false,
            error: error.error || 'クライアントアカウントの取得に失敗しました',
          };
        }
        const data = await response.json();
        return {
          success: true,
          data: data.accounts as GoogleAdsClientAccount[],
        };
      },
      {
        onSuccess: data => {
          setClientAccounts(data || []);
          if (!data || data.length === 0) {
            setAlertMessage(
              'このマネージャーアカウント配下に有効なクライアントアカウントが見つかりませんでした。'
            );
          }
        },
        setLoading: setIsClientLoading,
        setMessage: setAlertMessage,
        defaultErrorMessage: 'クライアントアカウントの取得に失敗しました',
      }
    );
  };

  const handleTopLevelAccountChange = async (customerId: string) => {
    const account = accounts.find(a => a.customerId === customerId);
    if (!account) return;

    setSelectedAccount(account);
    setAlertMessage(null);
    setSelectedClientCustomerId(null); // 上位アカウント変更時はクライアント選択を必ずリセット

    if (account.isManager) {
      // マネージャーアカウントの場合、配下のクライアントを取得して表示
      // 自動保存は絶対にしない
      await fetchClientAccounts(customerId);
    } else {
      // 通常アカウントの場合、そのまま保存処理へ
      setClientAccounts([]);
      setSelectedClientCustomerId(customerId);
      await saveSelectedAccount(customerId);
    }
  };

  const handleClientAccountChange = async (clientCustomerId: string) => {
    setSelectedClientCustomerId(clientCustomerId);
    await saveSelectedAccount(clientCustomerId);
  };

  const saveSelectedAccount = async (customerId: string) => {
    setAlertMessage(null);

    await handleAsyncAction(
      async (): Promise<ServerActionResult<void>> => {
        const response = await fetch('/api/google-ads/accounts/select', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ customerId }),
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
            onAccountSelected(customerId);
          } else {
            // ページをリロードして状態を更新
            setTimeout(() => {
              router.refresh();
            }, 1000);
          }
        },
        setLoading: setIsSaving,
        setMessage: setAlertMessage,
        defaultErrorMessage: 'アカウント選択の保存に失敗しました',
      }
    );
  };

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 block">Google Ads アカウント</label>
        <p className="text-xs text-gray-500 mb-2">
          ログインしたGoogleアカウントに紐付く広告アカウントを選択してください。
        </p>

        <Select
          value={selectedAccount?.customerId || ''}
          onValueChange={value => {
            void handleTopLevelAccountChange(value);
          }}
          disabled={isLoading || isSaving}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="アカウントを選択してください" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(account => (
              <SelectItem key={account.customerId} value={account.customerId}>
                <div className="flex flex-col text-left">
                  <span className="font-medium truncate">{account.displayName}</span>
                  <span className="text-xs text-gray-400">
                    ID: {account.customerId}
                    {account.isManager && ' (MCC)'}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-xs text-gray-500 min-h-[20px]">
          {isLoading && 'アカウント一覧を取得中...'}
          {!isLoading && accounts.length === 0 && (
            <span className="text-orange-600">
              アクセス可能なアカウントが見つかりませんでした。
            </span>
          )}
        </div>
      </div>

      {/* マネージャーアカウント選択時のクライアント選択 UI */}
      {selectedAccount?.isManager && (
        <div className="pl-4 border-l-2 border-blue-100 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 text-blue-800 text-sm font-medium">
            <ArrowRight className="h-4 w-4" />
            <span>分析対象のクライアントアカウントを選択</span>
          </div>

          <Select
            value={selectedClientCustomerId || ''}
            onValueChange={value => {
              void handleClientAccountChange(value);
            }}
            disabled={isClientLoading || isSaving}
          >
            <SelectTrigger className="w-full bg-blue-50/50">
              <SelectValue placeholder="クライアントアカウントを選択" />
            </SelectTrigger>
            <SelectContent>
              {clientAccounts.map(client => (
                <SelectItem key={client.customerId} value={client.customerId}>
                  <div className="flex flex-col text-left">
                    <span className="truncate">{client.name}</span>
                    <span className="text-xs text-gray-400">ID: {client.customerId}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-xs text-gray-500 min-h-[20px]">
            {isClientLoading && 'クライアントアカウントを取得中...'}
            {!isClientLoading && clientAccounts.length === 0 && (
              <span className="text-orange-600">
                表示可能なクライアントアカウントがありません。
              </span>
            )}
          </div>
        </div>
      )}

      {selectedClientCustomerId && !isSaving && !alertMessage && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 border border-green-100 flex items-center gap-2 animate-in fade-in duration-300">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span>
            選択中のアカウントID:{' '}
            <span className="font-mono font-medium">{selectedClientCustomerId}</span>
          </span>
        </div>
      )}

      {alertMessage && (
        <div
          className={`rounded-md px-4 py-3 text-sm animate-in fade-in zoom-in-95 duration-200 ${
            alertMessage.includes('失敗') ||
            alertMessage.includes('エラー') ||
            alertMessage.includes('関連付けられていません') ||
            alertMessage.includes('見つかりませんでした')
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
                  既存のGoogle
                  Adsアカウントの「ユーザーとアクセス」から、このGoogleアカウントにアクセス権限を追加する
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 flex-wrap pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            fetchAccounts();
            if (selectedAccount?.isManager) {
              setClientAccounts([]);
              setSelectedClientCustomerId(null);
            }
          }}
          disabled={isLoading || isSaving}
          className="flex items-center gap-2 text-gray-600"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          アカウント一覧を更新
        </Button>
      </div>
    </div>
  );
}
