'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Unplug } from 'lucide-react';
import { disconnectGoogleAds } from '@/server/actions/googleAds.actions';
import { handleAsyncAction } from '@/lib/async-handler';

interface GoogleAdsSetupClientProps {
  isConnected: boolean;
}

export function GoogleAdsSetupClient({ isConnected }: GoogleAdsSetupClientProps) {
  const router = useRouter();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const handleDisconnect = async () => {
    if (!confirm('Google Ads連携を解除しますか？')) {
      return;
    }

    await handleAsyncAction(disconnectGoogleAds, {
      onSuccess: () => {
        setAlertMessage('連携を解除しました');
        router.refresh();
      },
      setLoading: setIsDisconnecting,
      setMessage: setAlertMessage,
      defaultErrorMessage: '連携解除に失敗しました',
    });
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="space-y-4">
      {alertMessage && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            alertMessage.includes('失敗') || alertMessage.includes('エラー')
              ? 'border border-red-200 bg-red-50 text-red-900'
              : 'border border-green-200 bg-green-50 text-green-900'
          }`}
        >
          {alertMessage}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleDisconnect}
          disabled={isDisconnecting}
          className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
        >
          <Unplug className="h-4 w-4" />
          連携解除
        </Button>
      </div>
    </div>
  );
}
