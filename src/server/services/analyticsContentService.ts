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

/** カテゴリ一覧取得時の1リクエストあたりの件数（ページングで全件走査する） */
const CATEGORY_NAMES_PAGE_SIZE = 1000;

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
   */
  async getAvailableCategoryNames(): Promise<string[]> {
    try {
      const { userId } = await this.resolveUser();
      const client = supabaseService.getClient();

      const { data: accessibleIds, error: accessError } = await client.rpc(
        'get_accessible_user_ids',
        { p_user_id: userId }
      );

      if (accessError || !accessibleIds || !Array.isArray(accessibleIds)) {
        return [];
      }

      const names = new Set<string>();
      let offset = 0;
      const baseQuery = client
        .from('content_annotations')
        .select('wp_category_names')
        .in('user_id', accessibleIds)
        .order('id', { ascending: true });

      while (true) {
        const { data: rows, error } = await baseQuery.range(
          offset,
          offset + CATEGORY_NAMES_PAGE_SIZE - 1
        );

        if (error) {
          console.error('[AnalyticsContentService] getAvailableCategoryNames failed:', error.message);
          return [];
        }

        for (const row of rows ?? []) {
          const arr = row?.wp_category_names;
          if (!Array.isArray(arr)) continue;
          for (const n of arr) {
            if (typeof n === 'string' && n.trim().length > 0) names.add(n.trim());
          }
        }

        if (!rows || rows.length < CATEGORY_NAMES_PAGE_SIZE) break;
        offset += CATEGORY_NAMES_PAGE_SIZE;
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
