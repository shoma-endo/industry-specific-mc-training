import { cookies } from 'next/headers';

import { authMiddleware } from '@/server/middleware/auth.middleware';
import { ContentAnnotationRepository } from '@/server/repositories/ContentAnnotationRepository';
import type { AnnotationRecord } from '@/types/annotation';
import type {
  AnalyticsContentItem,
  AnalyticsContentPage,
  AnalyticsContentQuery,
} from '@/types/analytics';

const MAX_PER_PAGE = 100;

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

      const repository = new ContentAnnotationRepository();
      const { data: annotations, count } = await repository.findByUserIdWithPaging(userId, from, to);

      const total = count;
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
      const message =
        error instanceof Error ? error.message : 'ページデータの取得に失敗しました';
      return {
        ...baseline,
        error: message,
      };
    }
  }

  private async resolveUser(): Promise<{ userId: string }> {
    const cookieStore = await cookies();
    const liffAccessToken = cookieStore.get('line_access_token')?.value;
    const refreshToken = cookieStore.get('line_refresh_token')?.value;

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
