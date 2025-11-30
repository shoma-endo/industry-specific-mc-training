'use server';

import { SupabaseService } from '@/server/services/supabaseService';
import { llmChat } from '@/server/services/llmService';
import { PromptService } from '@/server/services/promptService';
import { MODEL_CONFIGS } from '@/lib/constants';

/**
 * DBを書き換えず、ハードコーディングの入力でClaudeに実リクエストして
 * 生成結果だけを返すデモ用Action。
 */
export async function runDummyClaudeSuggestion(): Promise<{
  success: boolean;
  suggestion?: string;
  error?: string;
}> {
  // 認証チェックは任意（デモ用途）。失敗しても続行。
  const supabase = new SupabaseService().getClient();
  try {
    await supabase.auth.getUser();
  } catch {
    /* no-op for demo */
  }

  // テンプレを1本選んで実行（ctr_boost）
  const template = await PromptService.getTemplateByName('gsc_insight_ctr_boost');
  if (!template) {
    return { success: false, error: 'テンプレート取得に失敗しました' };
  }

  const templateContent = PromptService.replaceVariables(template.content, {
    adsHeadline: '【最新版】SEO改善で集客を伸ばす方法｜初心者向けチェックリスト',
    adsDescription: '検索順位低下を止める5つの改善施策。タイトルと見出し、FAQでCTRを底上げ',
  });

  const buildMessages = (content: string) => [
    { role: 'system' as const, content },
    { role: 'user' as const, content: '上記設定に従って改善提案を生成してください。' },
  ];

  const modelConfig = MODEL_CONFIGS['gsc_insight_ctr_boost'];
  if (!modelConfig) {
    return { success: false, error: 'モデル設定が見つかりません' };
  }

  // 3テンプレを並列で実行
  const runOne = async (name: string, vars: Record<string, string>) => {
    const t = await PromptService.getTemplateByName(name);
    if (!t) return '';
    const content = PromptService.replaceVariables(t.content, vars);
    const cfg = MODEL_CONFIGS[name];
    if (!cfg) return '';
    return await llmChat(cfg.provider, cfg.actualModel, buildMessages(content), {
      maxTokens: Math.min(4000, cfg.maxTokens),
      temperature: cfg.temperature,
    });
  };

  const [fullText, intro, body] = await Promise.all([
    llmChat(modelConfig.provider, modelConfig.actualModel, buildMessages(templateContent), {
      maxTokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature,
    }),
    runOne('gsc_insight_intro_refresh', {
      openingProposal: '現状の導入文ではベネフィットが弱いため、検索意図「比較・FAQ」を冒頭で提示する',
    }),
    runOne('gsc_insight_body_rewrite', {
      wpContent:
        '本文サンプル：SEO順位が落ちたときに確認するチェックリスト。タイトル、見出し、内部リンク、FAQ、構造化データ。',
    }),
  ]);

  const suggestion =
    `# 広告タイトル・説明文の提案\n${fullText}\n\n---\n\n` +
    (intro ? `# 書き出し案の提案\n${intro}\n\n---\n\n` : '') +
    (body ? `# 本文の提案\n${body}` : '');

  return { success: true, suggestion };
}
