import { GscService } from './gscService';
import { SupabaseService } from './supabaseService';
import { getGscQueryMaxPages, getGscQueryRowLimit } from '../lib/gsc-config';
import { normalizeQuery } from '../../lib/normalize-query';
import type {
  GscPageMetric,
  GscPropertyType,
  GscQueryMetricInsert,
  GscSearchAnalyticsRow,
  GscSearchType,
  GscImportOptions,
  GscImportResult,
} from '@/types/gsc';

export class GscImportService {
  private readonly gscService = new GscService();
  private readonly supabaseService = new SupabaseService();
  private readonly queryRowLimit = getGscQueryRowLimit();
  private readonly queryMaxPages = getGscQueryMaxPages();

  async importMetrics(userId: string, options: GscImportOptions): Promise<GscImportResult> {
    const startDate = options.startDate;
    const endDate = options.endDate;
    const searchType = options.searchType ?? 'web';
    const maxRows = options.maxRows ?? 1000;

    const credentials = await this.supabaseService.getGscCredentialByUserId(userId);
    if (!credentials) {
      throw new Error('GSC資格情報が見つかりません');
    }

    const refreshed = await this.gscService.refreshAccessToken(credentials.refreshToken);
    const accessToken = refreshed.accessToken;
    const propertyUri = credentials.propertyUri;
    if (!propertyUri) {
      throw new Error('GSCプロパティが設定されていません');
    }

    const rows = await this.fetchSearchAnalytics({
      accessToken,
      propertyUri,
      startDate,
      endDate,
      searchType,
      rowLimit: maxRows,
      dimensions: ['date', 'page'],
    });

    const metrics: GscPageMetric[] = rows
      .map(row => this.toMetric(userId, propertyUri, searchType, row))
      .filter((m): m is GscPageMetric => m !== null);

    const matchMap = await this.loadAnnotationUrlMap(userId);
    const propertyType = this.getPropertyType(propertyUri, credentials.propertyType ?? null);

    let upserted = 0;
    let skipped = 0;
    let unmatched = 0;

    for (const metric of metrics) {
      const normalized = metric.normalizedUrl ?? null;
      const annotationId = normalized ? matchMap.get(normalized) ?? null : null;

      // 紐付けできないデータは保存しない（評価対象外のノイズを避ける）
      if (!annotationId) {
        skipped += 1;
        unmatched += 1;
        continue;
      }

      const upsertPayload = {
        user_id: userId,
        content_annotation_id: annotationId,
        property_uri: metric.propertyUri,
        search_type: metric.searchType,
        date: metric.date,
        url: metric.url,
        clicks: metric.clicks,
        impressions: metric.impressions,
        ctr: metric.ctr,
        position: metric.position,
        imported_at: new Date().toISOString(),
      };

      const { error } = await this.supabaseService
        .getClient()
        .from('gsc_page_metrics')
        .upsert(upsertPayload, {
          onConflict: 'user_id,property_uri,date,normalized_url,search_type',
        });

      if (error) {
        skipped += 1;
        continue;
      }

      upserted += 1;
    }

    await this.importQueryMetrics({
      userId,
      propertyUri,
      propertyType,
      searchType,
      accessToken,
      startDate,
      endDate,
      matchMap,
    });

    return {
      totalFetched: metrics.length,
      upserted,
      skipped,
      unmatched,
      evaluated: 0,
    };
  }

  private async fetchSearchAnalytics({
    accessToken,
    propertyUri,
    startDate,
    endDate,
    searchType,
    rowLimit,
    startRow,
    dimensions,
  }: {
    accessToken: string;
    propertyUri: string;
    startDate: string;
    endDate: string;
    searchType: GscSearchType;
    rowLimit: number;
    startRow?: number;
    dimensions: string[];
  }): Promise<GscSearchAnalyticsRow[]> {
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUri)}/searchAnalytics/query`;
    const body: Record<string, unknown> = {
      startDate,
      endDate,
      dimensions,
      searchType,
      rowLimit,
    };

    if (typeof startRow === 'number' && startRow > 0) {
      body.startRow = startRow;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GSC Search Analytics API エラー: ${response.status} ${text}`);
    }

    const json = (await response.json()) as { rows?: GscSearchAnalyticsRow[] };
    return Array.isArray(json.rows) ? json.rows : [];
  }

  private toMetric(
    userId: string,
    propertyUri: string,
    searchType: GscSearchType,
    row: GscSearchAnalyticsRow
  ): GscPageMetric | null {
    const dateKey = row.keys?.[0];
    const pageUrl = row.keys?.[1];

    if (!dateKey || !pageUrl) {
      return null;
    }

    const normalized = this.normalizeUrl(pageUrl);
    return {
      id: crypto.randomUUID(),
      userId,
      propertyUri,
      searchType,
      date: dateKey,
      url: pageUrl,
      normalizedUrl: normalized,
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
      importedAt: new Date().toISOString(),
    };
  }

  private async importQueryMetrics({
    userId,
    propertyUri,
    propertyType,
    searchType,
    accessToken,
    startDate,
    endDate,
    matchMap,
  }: {
    userId: string;
    propertyUri: string;
    propertyType: GscPropertyType;
    searchType: GscSearchType;
    accessToken: string;
    startDate: string;
    endDate: string;
    matchMap: Map<string, string>;
  }): Promise<void> {
    const rows = await this.fetchQueryAnalyticsRows({
      accessToken,
      propertyUri,
      startDate,
      endDate,
      searchType,
    });

    if (!rows.length) {
      return;
    }

    const metrics: GscQueryMetricInsert[] = rows
      .map(row =>
        this.toQueryMetric({
          userId,
          propertyUri,
          propertyType,
          searchType,
          row,
          matchMap,
        })
      )
      .filter((metric): metric is GscQueryMetricInsert => metric !== null);

    if (!metrics.length) {
      return;
    }

    const deduped = this.aggregateQueryMetrics(metrics);
    await this.supabaseService.upsertGscQueryMetrics(deduped);
  }

  /**
   * 同一キー (userId, propertyUri, date, normalizedUrl, queryNormalized, searchType) 内の重複行を集約し、
   * clicks / impressions は合算、ctr は合算値から再計算、position は impressions 加重平均で代表値を決める。
   * contentAnnotationId は非 null を優先採用する。
   */
  private aggregateQueryMetrics(metrics: GscQueryMetricInsert[]): GscQueryMetricInsert[] {
    const map = new Map<string, GscQueryMetricInsert & { weightedPositionSum: number }>();

    for (const metric of metrics) {
      const key = [
        metric.userId,
        metric.propertyUri,
        metric.date,
        metric.normalizedUrl,
        metric.queryNormalized,
        metric.searchType,
      ].join('|');

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          ...metric,
          weightedPositionSum: metric.position * metric.impressions,
        });
        continue;
      }

      const clicks = existing.clicks + metric.clicks;
      const impressions = existing.impressions + metric.impressions;
      const weightedPositionSum = existing.weightedPositionSum + metric.position * metric.impressions;

      // contentAnnotationId は非 null を優先
      const contentAnnotationId = existing.contentAnnotationId ?? metric.contentAnnotationId ?? null;

      map.set(key, {
        ...existing,
        clicks,
        impressions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        position: impressions > 0 ? weightedPositionSum / impressions : 0,
        contentAnnotationId,
        // importedAt / url / query は代表値として既存をそのまま使用
        weightedPositionSum,
      });
    }

    return Array.from(map.values()).map(value => {
      const { weightedPositionSum, ...rest } = value;
      void weightedPositionSum; // eslint整合: 集約用の一時値を破棄
      return rest;
    });
  }

  private async fetchQueryAnalyticsRows({
    accessToken,
    propertyUri,
    startDate,
    endDate,
    searchType,
  }: {
    accessToken: string;
    propertyUri: string;
    startDate: string;
    endDate: string;
    searchType: GscSearchType;
  }): Promise<GscSearchAnalyticsRow[]> {
    const rows: GscSearchAnalyticsRow[] = [];
    let startRow = 0;
    for (let page = 0; page < this.queryMaxPages; page += 1) {
      const batch = await this.fetchSearchAnalytics({
        accessToken,
        propertyUri,
        startDate,
        endDate,
        searchType,
        rowLimit: this.queryRowLimit,
        startRow,
        // dimensions 順に合わせて keys を受け取る
        dimensions: ['date', 'query', 'page'],
      });

      if (!batch.length) {
        break;
      }

      rows.push(...batch);

      if (batch.length < this.queryRowLimit) {
        break;
      }

      startRow += this.queryRowLimit;
    }

    return rows;
  }

  private toQueryMetric({
    userId,
    propertyUri,
    propertyType,
    searchType,
    row,
    matchMap,
  }: {
    userId: string;
    propertyUri: string;
    propertyType: GscPropertyType;
    searchType: GscSearchType;
    row: GscSearchAnalyticsRow;
    matchMap: Map<string, string>;
  }): GscQueryMetricInsert | null {
    const [dateKey, queryText, pageUrl] = row.keys ?? [];
    if (!dateKey || !pageUrl || !queryText) {
      return null;
    }

    const normalizedUrl = this.normalizeUrl(pageUrl);
    if (!normalizedUrl) {
      return null;
    }

    const queryNormalized = normalizeQuery(queryText);
    if (!queryNormalized) {
      return null;
    }

    const clicks = row.clicks ?? 0;
    const impressions = row.impressions ?? 0;

    if (clicks === 0 && impressions === 0) {
      return null;
    }

    const importedAt = new Date().toISOString();
    return {
      userId,
      propertyUri,
      propertyType,
      searchType,
      date: dateKey,
      url: pageUrl,
      normalizedUrl,
      query: queryText,
      queryNormalized,
      clicks,
      impressions,
      ctr: this.calculateCtr(clicks, impressions, row.ctr),
      position: typeof row.position === 'number' ? row.position : 0,
      contentAnnotationId: matchMap.get(normalizedUrl) ?? null,
      importedAt,
    };
  }

  private async loadAnnotationUrlMap(userId: string): Promise<Map<string, string>> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('content_annotations')
      .select('id, normalized_url')
      .eq('user_id', userId)
      .not('normalized_url', 'is', null);

    if (error) {
      throw new Error(error.message || 'content_annotations の取得に失敗しました');
    }

    const map = new Map<string, string>();
    (data ?? []).forEach(row => {
      if (row.normalized_url && row.id) {
        map.set(row.normalized_url, row.id);
      }
    });
    return map;
  }

  private normalizeUrl(url: string | undefined): string | null {
    if (!url) return null;
    try {
      // PostgreSQL の public.normalize_url と完全一致させる
      // lowercase, remove protocol + www, trim trailing slash (先頭スラッシュは削除しない)
      const lowered = url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
      return lowered.replace(/\/+$/g, '');
    } catch {
      return null;
    }
  }

  private getPropertyType(propertyUri: string, fallback?: GscPropertyType | null): GscPropertyType {
    if (fallback === 'sc-domain' || fallback === 'url-prefix') {
      return fallback;
    }
    return propertyUri.startsWith('sc-domain:') ? 'sc-domain' : 'url-prefix';
  }

  private calculateCtr(clicks: number, impressions: number, fallback?: number): number {
    if (typeof fallback === 'number') {
      return fallback;
    }
    if (impressions <= 0) {
      return 0;
    }
    return clicks / impressions;
  }
}

export const gscImportService = new GscImportService();
