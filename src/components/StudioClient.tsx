// src/components/StudioClient.tsx
'use client'
import dynamicNoSSR from 'next/dynamic';
export const StudioClient = dynamicNoSSR(
  () => import('next-sanity/studio').then((mod) => mod.NextStudio),
  { ssr: false }
);
