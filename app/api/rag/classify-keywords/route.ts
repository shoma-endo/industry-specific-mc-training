import { NextRequest, NextResponse } from 'next/server';
import { RAGKeywordClassifier } from '@/lib/rag-keyword-classifier';
import type { ClassifyKeywordsRequest } from '@/types/rag';

/**
 * RAGキーワード分類 API エンドポイント
 * 
 * POST /api/rag/classify-keywords
 * - キーワード配列を受け取り、RAGシステムで分類
 * - 類似事例に基づく高精度な分類を実現
 */
export async function POST(request: NextRequest) {
  try {
    const body: ClassifyKeywordsRequest = await request.json();
    const { keywords, options = {} } = body;

    // 入力検証
    if (!Array.isArray(keywords)) {
      return NextResponse.json(
        { 
          error: 'キーワードの配列が必要です',
          code: 'INVALID_INPUT' 
        },
        { status: 400 }
      );
    }

    if (keywords.length === 0) {
      return NextResponse.json(
        { 
          error: 'キーワードを1つ以上指定してください',
          code: 'EMPTY_KEYWORDS' 
        },
        { status: 400 }
      );
    }

    if (keywords.length > 20) {
      return NextResponse.json(
        { 
          error: 'キーワードは最大20個までです',
          code: 'TOO_MANY_KEYWORDS' 
        },
        { status: 400 }
      );
    }

    // 各キーワードが文字列であることを確認
    const invalidKeywords = keywords.filter(k => typeof k !== 'string' || k.trim().length === 0);
    if (invalidKeywords.length > 0) {
      return NextResponse.json(
        { 
          error: '無効なキーワードが含まれています',
          code: 'INVALID_KEYWORDS',
          details: { invalidKeywords }
        },
        { status: 400 }
      );
    }

    // オプションの検証
    if (options.confidenceThreshold && (
      typeof options.confidenceThreshold !== 'number' || 
      options.confidenceThreshold < 0 || 
      options.confidenceThreshold > 1
    )) {
      return NextResponse.json(
        { 
          error: '信頼度閾値は0から1の間の数値である必要があります',
          code: 'INVALID_CONFIDENCE_THRESHOLD' 
        },
        { status: 400 }
      );
    }

    // RAG分類実行
    const classifier = new RAGKeywordClassifier();
    const result = await classifier.classifyKeywords(keywords, options);

    // レスポンス統計の記録（オプション）
    console.log(`RAG分類完了: ${keywords.length}キーワード, 処理時間: ${result.metadata.processingTime}ms, 信頼度: ${result.metadata.confidence}`);

    return NextResponse.json(result, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Processing-Time': result.metadata.processingTime.toString(),
        'X-Confidence': result.metadata.confidence.toString()
      }
    });

  } catch (error: unknown) {
    console.error('RAG分類エラー:', error);

    // エラーの種類に応じたレスポンス
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EMBEDDING_ERROR') {
      return NextResponse.json(
        { 
          error: 'Embedding生成中にエラーが発生しました',
          code: 'EMBEDDING_ERROR' 
        },
        { status: 503 }
      );
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'DATABASE_ERROR') {
      return NextResponse.json(
        { 
          error: 'データベース処理中にエラーが発生しました',
          code: 'DATABASE_ERROR' 
        },
        { status: 503 }
      );
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'CLASSIFICATION_ERROR') {
      return NextResponse.json(
        { 
          error: 'キーワード分類処理中にエラーが発生しました',
          code: 'CLASSIFICATION_ERROR' 
        },
        { status: 503 }
      );
    }

    // 一般的なエラー
    return NextResponse.json(
      { 
        error: 'キーワード分類中に予期しないエラーが発生しました',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * RAGシステムの統計情報を取得
 * 
 * GET /api/rag/classify-keywords
 */
export async function GET() {
  try {
    const classifier = new RAGKeywordClassifier();
    
    // 統計情報の取得（データベースから）
    const { data } = await classifier['supabase']
      .rpc('get_keyword_statistics');

    if (!data) {
      return NextResponse.json(
        { 
          error: '統計情報の取得に失敗しました',
          code: 'STATISTICS_ERROR' 
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      statistics: data,
      message: 'RAGキーワード分類システムが利用可能です'
    });

  } catch (error) {
    console.error('RAG統計取得エラー:', error);
    
    return NextResponse.json(
      { 
        error: '統計情報の取得中にエラーが発生しました',
        code: 'STATISTICS_ERROR' 
      },
      { status: 500 }
    );
  }
}

/**
 * API使用方法を返す（開発・デバッグ用）
 */
export async function OPTIONS() {
  return NextResponse.json({
    endpoints: {
      'POST /api/rag/classify-keywords': {
        description: 'キーワード配列をRAGシステムで分類',
        parameters: {
          keywords: 'string[] - 分類するキーワード配列（最大20個）',
          options: {
            includeEvidence: 'boolean - 類似事例を含めるか（オプション）',
            confidenceThreshold: 'number - 信頼度閾値 0-1（オプション）'
          }
        },
        example: {
          keywords: ['東京 ハウスクリーニング', 'ハウスクリーニング とは'],
          options: {
            includeEvidence: true,
            confidenceThreshold: 0.7
          }
        }
      },
      'GET /api/rag/classify-keywords': {
        description: 'RAGシステムの統計情報を取得'
      }
    },
    system: {
      name: 'RAGキーワード分類システム',
      version: '1.0.0',
      description: 'ファインチューニングモデルからRAGシステムに移行した高精度キーワード分類'
    }
  });
}