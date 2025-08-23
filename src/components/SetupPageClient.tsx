'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { SetupPageClientProps } from '@/types/components';

export default function SetupPageClient({ hasWordPressSettings }: SetupPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = useMemo(() => searchParams?.get('edit') === 'true', [searchParams]);

  // ランディングページ機能削除に伴い、自動リダイレクトは実施しない。
  // 設定がある場合は何も表示しない（親側のUIを表示）。
  if (hasWordPressSettings && !isEditMode) {
    return null;
  }

  // WordPress設定がない場合はWordPress設定ページに案内
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-4">WordPress設定が必要です</h2>
        <p className="text-gray-600 mb-6">まずWordPressの設定を行ってください。</p>

        <button
          onClick={() => router.push('/setup/wordpress')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md"
        >
          WordPress設定ページへ
        </button>
      </div>
    </div>
  );
}
