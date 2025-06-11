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
  // projectIdが空文字やundefinedの場合はダミー値を使用
  const safeProjectId = projectId || 'dummy-project';
  const safeDataset = dataset || 'production';
  
  const config = createSanityConfig(safeProjectId, safeDataset);
  return <DynamicStudio config={config} />;
}
