import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { getLiffTokensFromCookies } from '@/server/lib/auth-helpers';
import type { AnnotationRecord } from '@/types/annotation';
import type {
  AnalyticsContentItem,
  AnalyticsContentPage,
  AnalyticsContentQuery,
} from '@/types/analytics';
import type { Json } from '@/types/database.types';

const MAX_PER_PAGE = 100;

const supabaseService = new SupabaseService();

export class AnalyticsContentService {
  async getPage(params: AnalyticsContentQuery): Promise<AnalyticsContentPage> {
    const page = Number.isFinite(params.page) ? Math.max(1, Math.floor(params.page)) : 1;
    const perPageRaw = Number.isFinite(params.perPage) ? Math.floor(params.perPage) : MAX_PER_PAGE;
    const perPage = Math.max(1, Math.min(MAX_PER_PAGE, perPageRaw));
    const selectedCategoryNames = this.normalizeCategoryNames(params.selectedCategoryNames);
    const includeUncategorized = params.includeUncategorized === true;

    const baseline: AnalyticsContentPage = {
      items: [],
      total: 0,
      totalPages: 1,
      page,
      perPage,
    };

    try {
      const { userId } = await this.resolveUser();

      const client = supabaseService.getClient();

      const fetchAnnotationsPage = async (targetPage: number) => {
        const { data, error } = await client.rpc('get_filtered_content_annotations', {
          p_user_id: userId,
          p_page: targetPage,
          p_per_page: perPage,
          p_selected_category_names: selectedCategoryNames,
          p_include_uncategorized: includeUncategorized,
        });

        const row = data?.[0] as
          | {
              items: Json;
              total_count: number | string | null;
            }
          | undefined;

        if (!row && !error) {
          console.warn('[AnalyticsContentService] RPC returned empty rows', {
            targetPage,
            perPage,
            selectedCategoryCount: selectedCategoryNames.length,
            includeUncategorized,
          });
        }

        const rawItems = row?.items;
        if (rawItems !== undefined && !Array.isArray(rawItems)) {
          console.warn('[AnalyticsContentService] Unexpected items format from RPC', {
            type: typeof rawItems,
          });
        }

        const hasInvalidItem =
          Array.isArray(rawItems) && rawItems.some(item => !this.isAnnotationRecord(item));
        if (hasInvalidItem) {
          console.warn('[AnalyticsContentService] RPC items contain invalid annotation shape');
        }

        const parsedItems =
          Array.isArray(rawItems) && rawItems.every(item => this.isAnnotationRecord(item))
            ? (rawItems as AnnotationRecord[])
            : [];
        const totalCount = row?.total_count;
        const total =
          typeof totalCount === 'number'
            ? totalCount
            : typeof totalCount === 'string'
              ? Number.parseInt(totalCount, 10) || 0
              : 0;

        return { data: parsedItems, error, total };
      };

      const firstResult = await fetchAnnotationsPage(page);
      let { data, error, total } = firstResult;

      if (error) {
        throw new Error(error.message || 'コンテンツ注釈の取得に失敗しました');
      }

      total = Math.max(0, total);
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const resolvedPage = Math.min(page, totalPages);

      if (resolvedPage !== page) {
        // 意図した仕様として、2回目フェッチ時も total/totalPages は初回フェッチの値を保持する
        // （フェッチ間でデータ変動が起きた場合、件数と取得データに一時的な不整合が生じる可能性はある）
        const resolvedResult = await fetchAnnotationsPage(resolvedPage);
        data = resolvedResult.data;
        error = resolvedResult.error;

        if (error) {
          throw new Error(error.message || 'コンテンツ注釈の取得に失敗しました');
        }
      }

      const annotations = data;
      const from = (resolvedPage - 1) * perPage;

      const items: AnalyticsContentItem[] = annotations.map((annotation, index) => ({
        rowKey: this.buildAnnotationRowKey(annotation, from + index),
        annotation,
      }));

      return {
        items,
        total,
        totalPages,
        page: resolvedPage,
        perPage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ページデータの取得に失敗しました';
      return {
        ...baseline,
        error: message,
      };
    }
  }

  private normalizeCategoryNames(input?: string[]): string[] {
    if (!Array.isArray(input)) {
      return [];
    }

    return Array.from(
      new Set(
        input
          .map(name => (typeof name === 'string' ? name.trim() : ''))
          .filter(name => name.length > 0)
      )
    );
  }

  private isAnnotationRecord(value: unknown): value is AnnotationRecord {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const record = value as Record<string, unknown>;
    return typeof record.id === 'string' && record.id.length > 0;
  }

  /**
   * アクセス可能な全アノテーションから wp_category_names を集約し、
   * 重複を除いてソートしたカテゴリ名の配列を返す。フィルターUIの選択肢に使用する。
   * DB側RPC関数で効率的に集約する（1回のラウンドトリップで完了）。
   */
  async getAvailableCategoryNames(): Promise<string[]> {
    try {
      const { userId } = await this.resolveUser();
      const client = supabaseService.getClient();

      // RPC関数でDB側で集約（1回のクエリで完了）
      const { data: rows, error } = await client.rpc('get_available_category_names', {
        p_user_id: userId,
      });

      if (error) {
        console.error('[AnalyticsContentService] getAvailableCategoryNames failed:', error.message);
        return [];
      }

      if (!Array.isArray(rows)) {
        return [];
      }

      // RPC関数は既にtrim済み・重複除去済み・ソート済みだが、防御的にSetで再重複除去
      const names = new Set<string>();
      for (const row of rows) {
        const name = row?.name;
        if (typeof name === 'string') {
          const trimmed = name.trim();
          if (trimmed.length > 0) {
            names.add(trimmed);
          }
        }
      }
      return Array.from(names).sort((a, b) => a.localeCompare(b, 'ja'));
    } catch (err) {
      console.error('[AnalyticsContentService] getAvailableCategoryNames error:', err);
      return [];
    }
  }

  private async resolveUser(): Promise<{ userId: string }> {
    const { accessToken: liffAccessToken, refreshToken } = await getLiffTokensFromCookies();

    const authResult = await authMiddleware(liffAccessToken, refreshToken);

    if (authResult.needsReauth || authResult.error || !authResult.userId) {
      throw new Error(authResult.error || 'ユーザー認証に失敗しました');
    }

    return { userId: authResult.userId };
  }

  private buildAnnotationRowKey(annotation: AnnotationRecord, fallbackIndex: number): string {
    if (annotation?.id) {
      return `annotation:${annotation.id}`;
    }
    if (annotation?.session_id) {
      return `annotation-session:${annotation.session_id}`;
    }
    return `annotation-index:${fallbackIndex}`;
  }
}

export const analyticsContentService = new AnalyticsContentService();
