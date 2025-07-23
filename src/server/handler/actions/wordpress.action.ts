import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { WordPressSettings } from '@/types/wordpress';

const supabaseService = new SupabaseService();

/**
 * WordPress設定を取得
 */
export async function getWordPressSettings(liffAccessToken: string): Promise<WordPressSettings | null> {
  const refreshToken = ''; // 必要に応じてリフレッシュトークンを取得

  const authResult = await authMiddleware(liffAccessToken, refreshToken);

  if (authResult.error || !authResult.userId) {
    throw new Error('認証に失敗しました');
  }

  return await supabaseService.getWordPressSettingsByUserId(authResult.userId);
}