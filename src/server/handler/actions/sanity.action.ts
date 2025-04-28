'use server';

import { userService } from '@/server/services/userService';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';

const supabaseService = new SupabaseService();

/**
 * ユーザーに紐づくSanityプロジェクトをLIFFアクセストークン経由で取得する
 */
export async function getSanityProject(liffAccessToken: string) {
  // LIFFアクセストークンからLINEユーザー情報を取得
  const authResult = await authMiddleware(liffAccessToken);
  if (authResult.error || authResult.requiresSubscription) {
    throw new Error('LIFFユーザーの取得に失敗しました');
  }
  const user = await userService.getUserFromLiffToken(liffAccessToken);
  if (!user) {
    throw new Error('LIFFユーザーの取得に失敗しました');
  }
  // Supabase認証ユーザーIDをLINEユーザーIDで取得
  const project = await supabaseService.getSanityProjectByUserId(authResult.userId!);
  return project;
}

/**
 * ユーザーのSanityプロジェクト情報をLIFFアクセストークン経由で登録する
 */
export async function createSanityProject(
  liffAccessToken: string,
  projectId: string,
  dataset: string
) {
  try {
    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error || authResult.requiresSubscription) {
      throw new Error('LIFFユーザーの取得に失敗しました');
    }
    await supabaseService.createSanityProject(authResult.userId!, projectId, dataset);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'サーバー側で予期せぬエラーが発生しました。'
    );
  }
}

export async function getSanityProjectForUser(lineAccessToken: string) {
  const user = await userService.getUserFromLiffToken(lineAccessToken);
  if (!user) {
    throw new Error('Failed to get user from LIFF token');
  }

  const supabaseService = new SupabaseService();
  const sbUser = await supabaseService.getUserByLineId(user.lineUserId);

  if (!sbUser) {
    throw new Error('Supabase user not found');
  }

  const { projectId, dataset } = await supabaseService.getSanityProjectInfoByUserId(sbUser.id);

  if (!projectId || !dataset) {
    throw new Error('Sanity project not found for user');
  }

  return {
    projectId,
    dataset,
  };
}
