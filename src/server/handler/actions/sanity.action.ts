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
    console.log('[SanityAction] createSanityProject in SupabaseService success.');
  } catch (error) {
    // ★★★ エラーオブジェクトの詳細をログ出力 ★★★
    console.error('[SanityAction] Caught error in createSanityProject.');
    console.error('[SanityAction] Error type:', typeof error);
    console.error(
      '[SanityAction] Error message:',
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      '[SanityAction] Error stack:',
      error instanceof Error ? error.stack : 'No stack available'
    );
    // Supabaseのエラーオブジェクトの場合、詳細が含まれている可能性がある
    if (error && typeof error === 'object') {
      console.error('[SanityAction] Full error object:', JSON.stringify(error, null, 2));
    }
    // ★★★ ここまで ★★★

    throw new Error(
      error instanceof Error ? error.message : 'サーバー側で予期せぬエラーが発生しました。'
    );
  }
}
