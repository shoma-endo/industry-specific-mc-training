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
 * ユーザーのSanityプロジェクト情報とWordPress設定情報をLIFFアクセストークン経由で登録する
 */
export async function createSanityProject(
  liffAccessToken: string,
  projectId: string,
  dataset: string,
  wpClientId: string,
  wpClientSecret: string,
  wpSiteId: string
) {
  try {
    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error || authResult.requiresSubscription || !authResult.userId) {
      throw new Error('LIFFユーザーの認証またはユーザーIDの取得に失敗しました');
    }
    const userId = authResult.userId;

    // 1. Sanityプロジェクト情報を保存
    await supabaseService.createSanityProject(userId, projectId, dataset);

    // 2. WordPress設定情報を保存 (SupabaseServiceに新しいメソッドが必要)
    // このメソッドは supabaseService.createOrUpdateWordPressSettings(userId, wpClientId, wpClientSecret, wpSiteId) のようなシグネチャを想定しています。
    // wpClientSecret の暗号化もここで検討できますが、まずはプレーンテキストで保存します。
    await supabaseService.createOrUpdateWordPressSettings(
      userId,
      wpClientId,
      wpClientSecret,
      wpSiteId
    ); // 仮のメソッド呼び出し
  } catch (error) {
    console.error('[ActionError] createSanityProject:', error); // エラーログを詳細に
    throw new Error(
      error instanceof Error ? error.message : 'サーバー側で予期せぬエラーが発生しました。'
    );
  }
}

export async function getSanityProjectForUser(lineAccessToken: string) {
  // 開発モードでダミートークンの場合は、固定のプロジェクト情報を返す
  if (process.env.NODE_ENV === 'development' && lineAccessToken === 'dummy-token') {
    console.log(
      '[Sanity Action] Development mode: Returning fixed Sanity project info for "dummy-token".'
    );
    return {
      projectId: 'booiieyk', // 提供されたプロジェクトIDに設定
      dataset: 'development', // 提供されたデータセットに設定
    };
  }

  // 通常の処理 (本番環境またはダミートークンでない場合)
  const user = await userService.getUserFromLiffToken(lineAccessToken);
  if (!user) {
    throw new Error('Failed to get user from LIFF token');
  }

  const supabaseService = new SupabaseService();
  // user.lineUserId を使用してSupabaseのユーザーを検索
  const sbUser = await supabaseService.getUserByLineId(user.lineUserId); // user.userId を user.lineUserId に変更

  if (!sbUser) {
    // sbUser が見つからない場合、そのLINEユーザーIDに紐づくSupabaseユーザーが存在しない
    // このケースも開発時には問題になる可能性があるため、ログを追加
    console.error(`[Sanity Action] Supabase user not found for LINE User ID: ${user.lineUserId}`); // user.userId を user.lineUserId に変更
    throw new Error(`Supabase user not found for the given LINE User ID: ${user.lineUserId}`); // user.userId を user.lineUserId に変更
  }

  const { projectId, dataset } = await supabaseService.getSanityProjectInfoByUserId(sbUser.id);

  if (!projectId || !dataset) {
    throw new Error('Sanity project not found for user in Supabase');
  }

  return {
    projectId,
    dataset,
  };
}
