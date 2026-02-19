import { authMiddleware } from '@/server/middleware/auth.middleware';
import { SupabaseService } from '@/server/services/supabaseService';
import { getLiffTokensFromCookies } from '@/server/lib/auth-helpers';
import type { AnnotationRecord } from '@/types/annotation';
import type {
  AnalyticsContentItem,
  AnalyticsContentPage,
  AnalyticsContentQuery,
} from '@/types/analytics';

const MAX_PER_PAGE = 100;

const supabaseService = new SupabaseService();

export class AnalyticsContentService {
  async getPage(params: AnalyticsContentQuery): Promise<AnalyticsContentPage> {
    const page = Number.isFinite(params.page) ? Math.max(1, Math.floor(params.page)) : 1;
    const perPageRaw = Number.isFinite(params.perPage) ? Math.floor(params.perPage) : MAX_PER_PAGE;
    const perPage = Math.max(1, Math.min(MAX_PER_PAGE, perPageRaw));

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

      // アクセス可能なユーザーIDを取得（オーナー/従業員の相互閲覧対応）
      const { data: accessibleIds, error: accessError } = await client.rpc(
        'get_accessible_user_ids',
        { p_user_id: userId }
      );

      if (accessError || !accessibleIds) {
        throw new Error('アクセス権の確認に失敗しました');
      }

      const fetchAnnotationsPage = async (targetPage: number) => {
        const from = (targetPage - 1) * perPage;
        const to = from + perPage - 1;

        const { data, error, count } = await client
          .from('content_annotations')
          .select('*', { count: 'exact', head: false })
          .in('user_id', accessibleIds)
          .order('updated_at', { ascending: false, nullsFirst: false })
          .range(from, to);

        return { data, error, count, from };
      };

      const firstResult = await fetchAnnotationsPage(page);
      let { data, error, from } = firstResult;
      const { count } = firstResult;

      if (error) {
        throw new Error(error.message || 'コンテンツ注釈の取得に失敗しました');
      }

      const initialAnnotations = (data ?? []) as AnnotationRecord[];
      const total = count ?? initialAnnotations.length;
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const resolvedPage = Math.min(page, totalPages);

      if (resolvedPage !== page) {
        // 意図した仕様として、2回目フェッチ時も total/totalPages は初回フェッチの値を保持する
        // （フェッチ間でデータ変動が起きた場合、件数と取得データに一時的な不整合が生じる可能性はある）
        const resolvedResult = await fetchAnnotationsPage(resolvedPage);
        data = resolvedResult.data;
        error = resolvedResult.error;
        from = resolvedResult.from;

        if (error) {
          throw new Error(error.message || 'コンテンツ注釈の取得に失敗しました');
        }
      }

      const annotations = (data ?? []) as AnnotationRecord[];

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
