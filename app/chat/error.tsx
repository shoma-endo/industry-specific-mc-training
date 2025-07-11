'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ChatError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // エラーをログに記録
    console.error('Chat page error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-3rem)] p-4">
      <Card className="p-6 text-center max-w-md w-full shadow-lg">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-red-600" />
        </div>
        
        <h2 className="text-lg font-semibold mb-3 text-gray-900">
          チャットの読み込み中にエラーが発生しました
        </h2>
        
        <p className="text-sm text-gray-600 mb-6">
          申し訳ございません。一時的な問題が発生しています。
          もう一度お試しいただくか、しばらく時間をおいてからアクセスしてください。
        </p>
        
        <div className="space-y-3">
          <Button 
            onClick={reset} 
            className="w-full"
            variant="default"
          >
            <RefreshCw size={16} className="mr-2" />
            再試行
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/'} 
            variant="outline" 
            className="w-full"
          >
            ホームに戻る
          </Button>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              開発者向け詳細情報
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}
      </Card>
    </div>
  );
}