import 'dotenv/config';
import { PromptService } from '../src/services/promptService';
import { PromptChunkService } from '../src/server/services/promptChunkService';

/**
 * lp_draft_creation テンプレートのチャンクを再生成するスクリプト。
 * 実行例:  npx ts-node --compiler-options '{"module":"commonjs"}' scripts/rebuild-lp-chunks.ts
 */
(async () => {
  try {
    const template = await PromptService.getTemplateByName('lp_draft_creation');
    if (!template) {
      console.error('テンプレート lp_draft_creation が見つかりません');
      process.exit(1);
    }

    console.log('チャンク再生成を開始:', template.id);
    await PromptChunkService.updatePromptChunks(template.id, template.content);
    console.log('チャンク再生成完了:', template.id);
  } catch (error) {
    console.error('チャンク再生成スクリプトエラー:', error);
    process.exit(1);
  }
})();
