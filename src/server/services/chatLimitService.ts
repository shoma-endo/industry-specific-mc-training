import { SupabaseService } from '@/server/services/supabaseService';
import type { UserRole } from '@/types/user';
import { ERROR_MESSAGES } from '@/lib/constants';

const DAILY_CHAT_LIMIT = 3;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getCurrentJstRange() {
  const nowUtc = new Date();
  const nowJst = new Date(nowUtc.getTime() + JST_OFFSET_MS);
  const startOfJstUtcMs = Date.UTC(
    nowJst.getUTCFullYear(),
    nowJst.getUTCMonth(),
    nowJst.getUTCDate(),
    0,
    0,
    0,
    0
  );
  const fromUtcMs = startOfJstUtcMs - JST_OFFSET_MS;
  const toUtcMs = fromUtcMs + 24 * 60 * 60 * 1000;

  return { fromUtcMs, toUtcMs };
}

/**
 * trial ユーザーの日次チャット送信上限をチェックし、超過時はエラー文言を返す
 */
export async function checkTrialDailyLimit(role: UserRole, userId: string): Promise<string | null> {
  if (role !== 'trial') {
    return null;
  }

  const supabase = new SupabaseService();
  const { fromUtcMs, toUtcMs } = getCurrentJstRange();
  const sentCountResult = await supabase.countUserMessagesBetween(userId, fromUtcMs, toUtcMs);

  if (!sentCountResult.success) {
    console.warn('[ChatLimitService] Daily limit check failed:', sentCountResult.error);
    return sentCountResult.error.userMessage;
  }

  const sentCountToday = sentCountResult.data;

  if (sentCountToday >= DAILY_CHAT_LIMIT) {
    return ERROR_MESSAGES.daily_chat_limit;
  }

  return null;
}
