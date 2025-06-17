'use client';

import { createSanityConfig } from '@/sanity/createSanityConfig';
import dynamic from 'next/dynamic';

const DynamicStudio = dynamic(
  () => import('next-sanity/studio').then(mod => mod.NextStudio),
  { ssr: false, loading: () => <p>Studioを読み込み中...</p> }
);
type Props = {
  projectId: string;
  dataset: string;
};

export function StudioClient({ projectId, dataset }: Props) {
  console.log('[StudioClient] Received props:', { projectId, dataset });
  
  // projectIdが空文字やundefinedの場合はエラー表示
  if (!projectId || projectId.trim() === '') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">エラー: Sanity Project IDが設定されていません</h2>
          <p className="text-gray-600 mb-4">
            Sanity Studioを使用するには、有効なProject IDが必要です。
          </p>
          <a href="/setup/sanity" className="text-blue-600 hover:underline">
            設定ページでProject IDを設定してください
          </a>
        </div>
      </div>
    );
  }
  
  const safeDataset = dataset || 'production';
  
  const config = createSanityConfig(projectId, safeDataset);
  return <DynamicStudio config={config} />;
}
