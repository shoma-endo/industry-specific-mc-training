'use server';

import { userService } from '@/server/services/userService';
import { authMiddleware, AuthMiddlewareResult } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { cookies } from 'next/headers';
const supabaseService = new SupabaseService();

/**
 * ユーザーに紐づくSanityプロジェクトをLIFFアクセストークン経由で取得する
 */
export async function getSanityProject(liffAccessToken: string) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  const authResult: AuthMiddlewareResult = await authMiddleware(liffAccessToken, refreshToken);

  if (authResult.error) {
    let errorMessage = 'LIFFユーザーの認証に失敗しました';
    errorMessage += `: ${authResult.error}`;
    throw new Error(errorMessage);
  }

  if (!authResult.userId) {
    throw new Error(
      'LIFFユーザーの認証に成功しましたが、アプリケーションユーザーIDが取得できませんでした。'
    );
  }

  const project = await supabaseService.getSanityProjectByUserId(authResult.userId);
  if (!project) {
    return null;
  }
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

    // 1. Sanityプロジェクト情報を保存（有効な値がある場合のみ）
    if (projectId && projectId.trim() !== '' && dataset && dataset.trim() !== '') {
      await supabaseService.createSanityProject(userId, projectId.trim(), dataset.trim());
    }

    // 2. WordPress設定情報が提供されている場合のみ保存
    if (wpClientId && wpClientSecret && wpSiteId) {
      await supabaseService.createOrUpdateWordPressSettings(
        userId,
        wpClientId,
        wpClientSecret,
        wpSiteId
      );
    }
  } catch (error) {
    console.error('[ActionError] createSanityProject:', error); // エラーログを詳細に
    throw new Error(
      error instanceof Error ? error.message : 'サーバー側で予期せぬエラーが発生しました。'
    );
  }
}

/**
 * ユーザーに紐づくWordPress設定をLIFFアクセストークン経由で取得する
 */
export async function getWordPressSettings(liffAccessToken: string) {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  const authResult: AuthMiddlewareResult = await authMiddleware(liffAccessToken, refreshToken);

  if (authResult.error) {
    let errorMessage = 'LIFFユーザーの認証に失敗しました';
    errorMessage += `: ${authResult.error}`;
    throw new Error(errorMessage);
  }

  if (!authResult.userId) {
    throw new Error(
      'LIFFユーザーの認証に成功しましたが、アプリケーションユーザーIDが取得できませんでした。'
    );
  }

  const wordpressSettings = await supabaseService.getWordPressSettingsByUserId(authResult.userId);
  return wordpressSettings;
}

/**
 * セルフホストWordPress設定をLIFFアクセストークン経由で登録する
 */
export async function createSelfHostedWordPressSettings(
  liffAccessToken: string,
  wpSiteUrl: string,
  wpUsername: string,
  wpApplicationPassword: string
) {
  try {
    const authResult = await authMiddleware(liffAccessToken);
    if (authResult.error || authResult.requiresSubscription || !authResult.userId) {
      throw new Error('LIFFユーザーの認証またはユーザーIDの取得に失敗しました');
    }
    const userId = authResult.userId;

    // セルフホストWordPress設定情報を保存
    // 注意: セルフホスト版ではSanityは使用しないため、Sanityプロジェクト情報は保存しない
    await supabaseService.createOrUpdateSelfHostedWordPressSettings(
      userId,
      wpSiteUrl,
      wpUsername,
      wpApplicationPassword
    );
  } catch (error) {
    console.error('[ActionError] createSelfHostedWordPressSettings:', error);
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
