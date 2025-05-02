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
  const config = createSanityConfig(projectId, dataset);
  return <DynamicStudio config={config} />;
}
