'use server';

import { SupabaseService } from '@/server/services/supabaseService';
import { revalidatePath } from 'next/cache';

export interface UnreadSuggestion {
  id: string;
  evaluation_date: string;
  url: string;
  keyword: string;
  suggestion_summary: string | null;
  outcome: 'improved' | 'no_change' | 'worse';
  previous_position: number | null;
  current_position: number;
}

export interface UnreadSuggestionsResponse {
  count: number;
  suggestions: UnreadSuggestion[];
}

/**
 * 未読のGSC改善提案を取得する
 */
export async function getUnreadSuggestions(): Promise<UnreadSuggestionsResponse> {
  const service = new SupabaseService();
  const supabase = service.getClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { count: 0, suggestions: [] };
  }

  // user_idはRLSで自動的に絞り込まれるが、明示的に指定
  // outcomeがimproved以外のもの（提案が生成されるもの）かつ未読のもの
  // content_annotationsをjoinしてURLなどの情報を取得したい
  const { data, error } = await supabase
    .from('gsc_article_evaluation_history')
    .select(`
      id,
      evaluation_date,
      suggestion_summary,
      outcome,
      previous_position,
      current_position,
      content_annotations!inner (
        id,
        target_keyword
      ),
      gsc_article_evaluations!inner (
        property_uri
      )
    `)
    .eq('is_read', false)
    .neq('outcome', 'improved')
    .order('evaluation_date', { ascending: false });

  if (error) {
    console.error('Error fetching unread suggestions:', error);
    return { count: 0, suggestions: [] };
  }

  if (!data || data.length === 0) {
    return { count: 0, suggestions: [] };
  }

  // クライアント向けに整形
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suggestions: UnreadSuggestion[] = data.map((item: any) => ({
    id: item.id,
    evaluation_date: item.evaluation_date,
    url: item.gsc_article_evaluations?.property_uri || '', // property_uriをURLとして代用（必要に応じて加工）
    keyword: item.content_annotations?.target_keyword || '',
    suggestion_summary: item.suggestion_summary,
    outcome: item.outcome,
    previous_position: item.previous_position,
    current_position: item.current_position,
  }));

  return {
    count: suggestions.length,
    suggestions,
  };
}

/**
 * 改善提案を既読にする
 */
export async function markSuggestionAsRead(historyId: string): Promise<{ success: boolean; error?: string }> {
  const service = new SupabaseService();
  const supabase = service.getClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const { error } = await supabase
    .from('gsc_article_evaluation_history')
    .update({ is_read: true })
    .eq('id', historyId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error marking suggestion as read:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  return { success: true };
}

/**
 * 全ての改善提案を既読にする
 */
export async function markAllSuggestionsAsRead(): Promise<{ success: boolean; error?: string }> {
  const service = new SupabaseService();
  const supabase = service.getClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const { error } = await supabase
    .from('gsc_article_evaluation_history')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all suggestions as read:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  return { success: true };
}

