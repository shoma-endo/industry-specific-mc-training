import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import { env } from '@/env';

const RequestSchema = z.object({
  userQuery: z.string().min(1),
  templateName: z.string().min(1),
});

const openaiProvider = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const TEMPLATE_PROMPTS = {
  lp_draft_creation: `あなたはRAGシステムの検索クエリ最適化専門家です。

ユーザーの入力を、ベクトル検索で最高のパフォーマンスを発揮できるように、具体的で意図が明確な検索クエリに変換してください。

対象タスク：ランディングページ（LP）の構成要素とドラフト作成

変換時の考慮事項：
- 曖昧な表現（「お願いします」「よろしく」等）は、具体的なLP作成に関する要素に変換
- LP構成要素：ヘッダー、ヒーローセクション、特徴・メリット、お客様の声、CTA、フッター
- 出力形式：HTML、CSS、コンテンツ案、デザイン案
- 業界固有の要素があれば含める

元のクエリ："{userQuery}"

最適化された検索クエリのみを返してください。説明は不要です。`,

  default: `ユーザーの入力「{userQuery}」を、RAGシステムのベクトル検索で最高のパフォーマンスを発揮できるように、具体的で意図が明確な検索クリに変換してください。

最適化された検索クエリのみを返してください。説明は不要です。`,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userQuery, templateName } = RequestSchema.parse(body);

    const promptTemplate =
      TEMPLATE_PROMPTS[templateName as keyof typeof TEMPLATE_PROMPTS] || TEMPLATE_PROMPTS.default;
    const prompt = promptTemplate.replace('{userQuery}', userQuery);

    const { text } = await generateText({
      model: openaiProvider('gpt-4o-mini'),
      prompt,
      maxTokens: 200,
      temperature: 0.3,
    });

    return NextResponse.json({
      optimizedQuery: text.trim(),
    });
  } catch (error) {
    console.error('Query generation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
