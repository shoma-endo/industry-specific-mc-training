import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getSanityProjectForUser } from '@/server/handler/actions/sanity.action';
import { createUserSanityClient, createDraftModeClient } from '@/sanity/lib/client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function getSanityClient(lineAccessToken: string) {
  const { projectId, dataset } = await getSanityProjectForUser(lineAccessToken);
  return createUserSanityClient(projectId, dataset);
}

// Draft Mode対応のSanityクライアント取得
export async function getDraftSanityClient(lineAccessToken: string) {
  const { projectId, dataset } = await getSanityProjectForUser(lineAccessToken);
  return createDraftModeClient(projectId, dataset);
}
