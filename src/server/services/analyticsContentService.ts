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
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;

      const client = supabaseService.getClient();

      // アクセス可能なユーザーIDを取得（オーナー/従業員の相互閲覧対応）
      const { data: accessibleIds, error: accessError } = await client.rpc(
        'get_accessible_user_ids',
        { p_user_id: userId }
      );

      if (accessError || !accessibleIds) {
        throw new Error('アクセス権の確認に失敗しました');
      }

      const { data, error, count } = await client
        .from('content_annotations')
        .select('*', { count: 'exact', head: false })
        .in('user_id', accessibleIds)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error) {
        throw new Error(error.message || 'コンテンツ注釈の取得に失敗しました');
      }

      const annotations = (data ?? []) as AnnotationRecord[];
      const total = count ?? annotations.length;
      const totalPages = Math.max(1, Math.ceil(total / perPage));

      const items: AnalyticsContentItem[] = annotations.map((annotation, index) => ({
        rowKey: this.buildAnnotationRowKey(annotation, from + index),
        annotation,
      }));

      return {
        items,
        total,
        totalPages,
        page,
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
