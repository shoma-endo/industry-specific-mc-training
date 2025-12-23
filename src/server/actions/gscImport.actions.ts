'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { gscImportService } from '@/server/services/gscImportService';
import { gscEvaluationService } from '@/server/services/gscEvaluationService';
import { splitRangeByDays, aggregateImportResults } from '@/server/lib/gsc-import-utils';

export interface GscImportParams {
  startDate: string;
  endDate: string;
  searchType?: 'web' | 'image' | 'news';
  maxRows?: number;
  runEvaluation?: boolean;
}

export async function runGscImport(params: GscImportParams) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('line_access_token')?.value;
    const refreshToken = cookieStore.get('line_refresh_token')?.value;

    const authResult = await authMiddleware(accessToken, refreshToken);
    if (authResult.error || !authResult.userId) {
      return { success: false, error: authResult.error || 'ユーザー認証に失敗しました' };
    }

    const { startDate, endDate, searchType = 'web', maxRows = 1000, runEvaluation = true } =
      params;

    if (!startDate || !endDate) {
      return { success: false, error: 'startDate と endDate は必須です' };
    }

    if (typeof maxRows !== 'number' || maxRows < 1 || maxRows > 25000) {
      return { success: false, error: 'maxRows は 1～25000 の範囲で指定してください' };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { success: false, error: '日付の形式が不正です' };
    }
    if (start > end) {
      return { success: false, error: '開始日は終了日より前である必要があります' };
    }
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      return { success: false, error: '期間は最大365日までです' };
    }

    const importOnce = async (segmentStart: string, segmentEnd: string) =>
      gscImportService.importMetrics(authResult.userId, {
        startDate: segmentStart,
        endDate: segmentEnd,
        searchType,
        maxRows,
      });

    const summary = await importWithSplit(importOnce, startDate, endDate, 30);

    // 評価実行（オプション）
    if (runEvaluation) {
      const evalSummary = await gscEvaluationService.runDueEvaluationsForUser(authResult.userId);
      summary.evaluated = evalSummary.processed;
    }

    revalidatePath('/gsc-import');
    return { success: true, data: summary };
  } catch (error) {
    console.error('[gsc-import] import failed', error);
    const message = error instanceof Error ? error.message : 'インポート処理に失敗しました';
    return { success: false, error: message };
  }
}

const importWithSplit = async (
  importOnce: (start: string, end: string) => Promise<{
    totalFetched: number;
    upserted: number;
    skipped: number;
    unmatched: number;
    evaluated: number;
    querySummary?: {
      fetchedRows: number;
      keptRows: number;
      dedupedRows: number;
      fetchErrorPages: number;
      skipped: {
        missingKeys: number;
        invalidUrl: number;
        emptyQuery: number;
        zeroMetrics: number;
      };
      hitLimit: boolean;
    };
  }>,
  startDate: string,
  endDate: string,
  segmentDays: number
) => {
  const ranges = splitRangeByDays(startDate, endDate, segmentDays);
  const results: Awaited<ReturnType<typeof importOnce>>[] = [];

  for (const range of ranges) {
    const result = await importOnce(range.start, range.end);
    results.push(result);
  }

  return aggregateImportResults(results, ranges.length);
};
