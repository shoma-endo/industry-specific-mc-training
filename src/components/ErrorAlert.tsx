import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  error: string;
  variant?: 'destructive' | 'default';
}

/**
 * エラーメッセージを表示するAlertコンポーネント
 * - 「設定ダッシュボード」の文字列を /setup へのリンクに自動変換
 * - 他のキーワードも将来的に追加可能
 */
export function ErrorAlert({ error, variant = 'destructive' }: ErrorAlertProps) {
  const renderErrorWithLinks = (errorText: string) => {
    // 「設定ダッシュボード」をリンクに変換
    if (errorText.includes('設定ダッシュボード')) {
      const parts = errorText.split('設定ダッシュボード');
      return (
        <>
          {parts[0]}
          <Link href="/setup" className="underline font-semibold hover:text-red-700">
            設定ダッシュボード
          </Link>
          {parts[1]}
        </>
      );
    }

    // 通常のエラーメッセージ
    return errorText;
  };

  return (
    <Alert variant={variant}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{renderErrorWithLinks(error)}</AlertDescription>
    </Alert>
  );
}
