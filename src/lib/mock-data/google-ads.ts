import type {
  GoogleAdsCampaignMetrics,
  GoogleAdsCampaignSummary,
  GoogleAdsKeywordMetric,
} from '@/types/googleAds.types';

/**
 * 開発環境用のモックキャンペーンデータ
 */
function createCampaignMetrics(
  base: Pick<
    GoogleAdsCampaignMetrics,
    | 'campaignName'
    | 'status'
    | 'clicks'
    | 'impressions'
    | 'cost'
    | 'qualityScore'
    | 'conversions'
    | 'searchImpressionShare'
  >
): GoogleAdsCampaignMetrics {
  return {
    ...base,
    ctr: base.impressions > 0 ? base.clicks / base.impressions : 0,
    cpc: base.clicks > 0 ? base.cost / base.clicks : 0,
    costPerConversion: base.conversions > 0 ? base.cost / base.conversions : null,
    conversionRate: base.clicks > 0 ? base.conversions / base.clicks : null,
  };
}

export const MOCK_CAMPAIGNS: GoogleAdsCampaignMetrics[] = [
  createCampaignMetrics({
    campaignName: '整体院 検索キャンペーン',
    status: 'ENABLED',
    clicks: 2498,
    impressions: 46840,
    cost: 405216,
    qualityScore: 7,
    conversions: 83,
    searchImpressionShare: 0.58,
  }),
  createCampaignMetrics({
    campaignName: 'マッサージ キャンペーン',
    status: 'ENABLED',
    clicks: 333,
    impressions: 4680,
    cost: 61938,
    qualityScore: 7,
    conversions: 15,
    searchImpressionShare: 0.62,
  }),
  createCampaignMetrics({
    campaignName: 'スポーツ整体キャンペーン',
    status: 'ENABLED',
    clicks: 289,
    impressions: 4260,
    cost: 65025,
    qualityScore: 8,
    conversions: 11,
    searchImpressionShare: 0.55,
  }),
  createCampaignMetrics({
    campaignName: 'リピーター向けキャンペーン',
    status: 'ENABLED',
    clicks: 0,
    impressions: 0,
    cost: 0,
    qualityScore: null,
    conversions: 0,
    searchImpressionShare: null,
  }),
];

function createKeywordMetric(
  base: Pick<
    GoogleAdsKeywordMetric,
    | 'keywordId'
    | 'keywordText'
    | 'matchType'
    | 'campaignName'
    | 'adGroupName'
    | 'clicks'
    | 'impressions'
    | 'cost'
    | 'qualityScore'
    | 'conversions'
    | 'searchImpressionShare'
  >
): GoogleAdsKeywordMetric {
  return {
    ...base,
    ctr: base.impressions > 0 ? base.clicks / base.impressions : 0,
    cpc: base.clicks > 0 ? base.cost / base.clicks : 0,
    costPerConversion: base.conversions > 0 ? base.cost / base.conversions : null,
    conversionRate: base.clicks > 0 ? base.conversions / base.clicks : null,
  };
}

export const MOCK_KEYWORDS: GoogleAdsKeywordMetric[] = [
  createKeywordMetric({
    keywordId: '1000001',
    keywordText: 'google ads api tool',
    matchType: 'EXACT',
    campaignName: 'Search Demo Campaign',
    adGroupName: 'API Tools',
    qualityScore: 8,
    conversions: 12,
    searchImpressionShare: 0.61,
    impressions: 2840,
    clicks: 151,
    cost: 22700,
  }),
  createKeywordMetric({
    keywordId: '1000002',
    keywordText: 'marketing automation',
    matchType: 'PHRASE',
    campaignName: 'Search Demo Campaign',
    adGroupName: 'Automation',
    qualityScore: 7,
    conversions: 9,
    searchImpressionShare: 0.54,
    impressions: 2330,
    clicks: 109,
    cost: 18312,
  }),
  createKeywordMetric({
    keywordId: '1000003',
    keywordText: 'keyword analysis dashboard',
    matchType: 'BROAD',
    campaignName: 'Search Demo Campaign',
    adGroupName: 'Analytics',
    qualityScore: 7,
    conversions: 6,
    searchImpressionShare: 0.49,
    impressions: 2678,
    clicks: 101,
    cost: 12187,
  }),
];

/**
 * キャンペーンデータからサマリーを計算
 */
export function calculateCampaignSummary(
  campaigns: GoogleAdsCampaignMetrics[]
): GoogleAdsCampaignSummary {
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalCost = campaigns.reduce((sum, c) => sum + c.cost, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);

  // 検索インプレッションシェア（有効キャンペーンの平均）
  const enabledWithShare = campaigns.filter(
    (c) => c.status === 'ENABLED' && c.searchImpressionShare !== null
  );
  const avgSearchImpressionShare =
    enabledWithShare.length > 0
      ? enabledWithShare.reduce((sum, c) => sum + (c.searchImpressionShare ?? 0), 0) /
        enabledWithShare.length
      : null;

  return {
    totalClicks,
    totalImpressions,
    totalCost,
    totalConversions,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    avgCpc: totalClicks > 0 ? totalCost / totalClicks : 0,
    avgConversionRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
    avgCostPerConversion: totalConversions > 0 ? totalCost / totalConversions : 0,
    avgSearchImpressionShare,
  };
}

/**
 * キーワード指標をキャンペーン単位に集計
 */
export function aggregateKeywordsToCampaigns(
  keywords: GoogleAdsKeywordMetric[]
): GoogleAdsCampaignMetrics[] {
  const campaignMap = new Map<
    string,
    {
      clicks: number;
      impressions: number;
      cost: number;
      conversions: number;
      qualityScores: number[];
      searchImpressionShares: number[];
    }
  >();

  for (const kw of keywords) {
    const existing = campaignMap.get(kw.campaignName);
    if (existing) {
      existing.clicks += kw.clicks;
      existing.impressions += kw.impressions;
      existing.cost += kw.cost;
      existing.conversions += kw.conversions;
      if (kw.qualityScore !== null) {
        existing.qualityScores.push(kw.qualityScore);
      }
      if (kw.searchImpressionShare !== null) {
        existing.searchImpressionShares.push(kw.searchImpressionShare);
      }
    } else {
      campaignMap.set(kw.campaignName, {
        clicks: kw.clicks,
        impressions: kw.impressions,
        cost: kw.cost,
        conversions: kw.conversions,
        qualityScores: kw.qualityScore !== null ? [kw.qualityScore] : [],
        searchImpressionShares: kw.searchImpressionShare !== null ? [kw.searchImpressionShare] : [],
      });
    }
  }

  const campaigns: GoogleAdsCampaignMetrics[] = [];

  for (const [campaignName, data] of campaignMap) {
    const avgQualityScore =
      data.qualityScores.length > 0
        ? Math.round(data.qualityScores.reduce((a, b) => a + b, 0) / data.qualityScores.length)
        : null;

    const avgSearchImpressionShare =
      data.searchImpressionShares.length > 0
        ? data.searchImpressionShares.reduce((a, b) => a + b, 0) / data.searchImpressionShares.length
        : null;

    campaigns.push({
      campaignName,
      status: 'ENABLED', // keyword_view は ENABLED のみ取得するため
      clicks: data.clicks,
      impressions: data.impressions,
      cost: data.cost,
      ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
      cpc: data.clicks > 0 ? data.cost / data.clicks : 0,
      qualityScore: avgQualityScore,
      conversions: data.conversions,
      costPerConversion: data.conversions > 0 ? data.cost / data.conversions : null,
      searchImpressionShare: avgSearchImpressionShare,
      conversionRate: data.clicks > 0 ? data.conversions / data.clicks : null,
    });
  }

  // impressions 降順でソート
  return campaigns.sort((a, b) => b.impressions - a.impressions);
}
