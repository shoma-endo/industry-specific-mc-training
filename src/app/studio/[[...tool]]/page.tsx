// src/app/studio/[...index]/page.tsx
'use client';

import dynamicNoSSR from 'next/dynamic';
// Sanity Studio の設定をインポート
import config from '../../../../sanity.config';

// Sanity Studio をクライアントサイドでのみ読み込む
const NextStudio = dynamicNoSSR(() => import('next-sanity/studio').then(mod => mod.NextStudio), {
  ssr: false,
});

export const dynamic = 'force-static';

export default function StudioPage() {
  return (
    <div className="w-full h-screen">
      <NextStudio config={config} />
    </div>
  );
}
