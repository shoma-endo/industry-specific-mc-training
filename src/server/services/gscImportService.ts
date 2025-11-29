import { GscService } from '@/server/services/gscService';
import { SupabaseService } from '@/server/services/supabaseService';
import { gscEvaluationService } from '@/server/services/gscEvaluationService';
import type { GscPageMetric, GscSearchType } from '@/types/gsc';

type ImportResult = {
  totalFetched: number;
  upserted: number;
  skipped: number;
  unmatched: number;
  evaluated: number;
};

interface ImportOptions {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  searchType?: GscSearchType;
  maxRows?: number;
  runEvaluation?: boolean;
}

interface SearchAnalyticsRow {
  keys: string[]; // [date, page]
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export class GscImportService {
  private readonly gscService = new GscService();
  private readonly supabaseService = new SupabaseService();

  async importAndMaybeEvaluate(userId: string, options: ImportOptions): Promise<ImportResult> {
    const summary = await this.importMetrics(userId, options);

    if (options.runEvaluation) {
      const evalSummary = await gscEvaluationService.runDueEvaluationsForUser(userId);
      summary.evaluated = evalSummary.processed;
    }

    return summary;
  }

  async importMetrics(userId: string, options: ImportOptions): Promise<ImportResult> {
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

    const rows = await this.fetchSearchAnalytics(
      accessToken,
      propertyUri,
      startDate,
      endDate,
      searchType,
      maxRows
    );

    const metrics: GscPageMetric[] = rows
      .map(row => this.toMetric(userId, propertyUri, searchType, row))
      .filter((m): m is GscPageMetric => m !== null);

    const matchMap = await this.loadAnnotationUrlMap(userId);

    let upserted = 0;
    let skipped = 0;
    let unmatched = 0;

    for (const metric of metrics) {
      const normalized = metric.normalizedUrl ?? null;
      const annotationId = normalized ? matchMap.get(normalized) ?? null : null;

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
      if (!annotationId) unmatched += 1;
    }

    return {
      totalFetched: metrics.length,
      upserted,
      skipped,
      unmatched,
      evaluated: 0,
    };
  }

  private async fetchSearchAnalytics(
    accessToken: string,
    propertyUri: string,
    startDate: string,
    endDate: string,
    searchType: GscSearchType,
    rowLimit: number
  ): Promise<SearchAnalyticsRow[]> {
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUri)}/searchAnalytics/query`;
    const body = {
      startDate,
      endDate,
      dimensions: ['date', 'page'],
      searchType,
      rowLimit,
    };

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

    const json = (await response.json()) as { rows?: SearchAnalyticsRow[] };
    return Array.isArray(json.rows) ? json.rows : [];
  }

  private toMetric(
    userId: string,
    propertyUri: string,
    searchType: GscSearchType,
    row: SearchAnalyticsRow
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
      // mimic normalize_url: lowercase, remove protocol + www, trim trailing slash
      const lowered = url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
      return lowered.replace(/\/+$|^\/+/, '');
    } catch {
      return null;
    }
  }
}

export const gscImportService = new GscImportService();
