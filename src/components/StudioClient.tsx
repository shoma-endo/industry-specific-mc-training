'use client';

import { NextStudio } from 'next-sanity/studio';
import { createSanityConfig } from '@/sanity/createSanityConfig';

type Props = {
  projectId: string;
  dataset: string;
};

export function StudioClient({ projectId, dataset }: Props) {
  const config = createSanityConfig(projectId, dataset);
  return <NextStudio config={config} />;
}
