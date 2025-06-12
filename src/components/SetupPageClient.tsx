'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SanityProjectForm from '@/components/SanityProjectForm';

interface Props {
  liffAccessToken: string;
  hasWordPressSettings: boolean;
}

export default function SetupPageClient({ liffAccessToken, hasWordPressSettings }: Props) {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(hasWordPressSettings);

  useEffect(() => {
    if (hasWordPressSettings) {
      console.log('[Setup] WordPress設定が見つかりました。/ad-form にリダイレクト中...');
      setIsRedirecting(true);
      
      // 同じタブでリダイレクト実行
      const performRedirect = () => {
        try {
          router.push('/ad-form');
        } catch (error) {
          console.error('[Setup] router.push failed:', error);
          window.location.href = '/ad-form';
        }
      };

      // 少し遅延してリダイレクト
      const timeoutId = setTimeout(performRedirect, 100);
      
      return () => clearTimeout(timeoutId);
    }
    
    // hasWordPressSettingsがfalseの場合は何もしない
    return undefined;
  }, [hasWordPressSettings, router]);

  // リダイレクト中の表示
  if (isRedirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg mb-4">WordPress.com設定が見つかりました</p>
          <p className="text-gray-600 mb-6">ランディングページ作成画面にリダイレクト中...</p>
          
          <button
            onClick={() => router.push('/ad-form')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md"
          >
            手動でランディングページ作成画面へ
          </button>
        </div>
      </div>
    );
  }

  // WordPress設定がない場合はSanityProjectFormを表示
  return <SanityProjectForm liffAccessToken={liffAccessToken} />;
}