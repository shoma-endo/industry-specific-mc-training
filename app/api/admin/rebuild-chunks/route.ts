import { NextRequest, NextResponse } from 'next/server';
import { PromptService } from '@/services/promptService';
import { PromptChunkService } from '@/server/services/promptChunkService';

export async function POST(request: NextRequest) {
  try {
    // リクエストボディから対象テンプレート名を取得
    const { templateName } = await request.json();

    if (!templateName) {
      return NextResponse.json({ error: 'templateName is required' }, { status: 400 });
    }

    console.log(`[Rebuild Chunks] ${templateName} の再生成を開始`);

    // テンプレートを取得
    const template = await PromptService.getTemplateByName(templateName);
    if (!template) {
      return NextResponse.json({ error: `Template '${templateName}' not found` }, { status: 404 });
    }

    // チャンクを強制再生成
    await PromptChunkService.updatePromptChunks(template.id, template.content);

    console.log(`[Rebuild Chunks] ${templateName} の再生成完了`);

    return NextResponse.json({
      success: true,
      message: `Chunks for '${templateName}' rebuilt successfully`,
      templateId: template.id,
    });
  } catch (error) {
    console.error('Chunk rebuild error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
