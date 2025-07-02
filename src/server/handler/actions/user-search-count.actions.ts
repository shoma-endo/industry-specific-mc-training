'use server';

import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { userRepository } from '@/server/services/userRepository';

/**
 * ユーザーの検索回数取得用のServer Action
 * CLAUDE.mdルールに従い、useEffectを避けてServer-side data fetchingを採用
 */

const getUserSearchCountSchema = z.object({
  liffAccessToken: z.string(),
});

export const getUserSearchCountAction = async (
  data: z.infer<typeof getUserSearchCountSchema>
): Promise<{ googleSearchCount: number; error?: string }> => {
  try {
    const { liffAccessToken } = getUserSearchCountSchema.parse(data);

    // 早期リターン: 認証チェック
    const auth = await authMiddleware(liffAccessToken);
    if (auth.error) {
      return { googleSearchCount: 0, error: auth.error };
    }

    // 早期リターン: ユーザー情報チェック
    if (!auth.lineUserId) {
      return { googleSearchCount: 0, error: 'LINE User ID not found' };
    }

    // 検索回数を取得
    const googleSearchCount = await userRepository.getUserSearchCount(auth.lineUserId);

    return { googleSearchCount };
  } catch (error) {
    console.error('Error getting user search count:', error);
    return { googleSearchCount: 0, error: 'Internal server error' };
  }
};