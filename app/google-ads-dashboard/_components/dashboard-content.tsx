import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MetricsCards } from './metrics-cards';
import { CampaignsTable } from './campaigns-table';
import { calculateCampaignSummary } from '@/lib/mock-data/google-ads';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';
import type { GoogleAdsCampaignMetrics } from '@/types/googleAds.types';

interface DashboardContentProps {
  campaigns: GoogleAdsCampaignMetrics[];
  errorMessage?: string;
  errorKind?: 'not_connected' | 'not_selected' | 'auth_expired' | 'admin_required' | 'unknown';
}

export function DashboardContent({
  campaigns,
  errorMessage,
  errorKind = 'unknown',
}: DashboardContentProps) {
  const summary = calculateCampaignSummary(campaigns);
  const hasData = campaigns.length > 0;
  const hasError = Boolean(errorMessage);

  const errorGuidance: Record<NonNullable<DashboardContentProps['errorKind']>, string> = {
    not_connected: ERROR_MESSAGES.GOOGLE_ADS.DASHBOARD_GUIDANCE_NOT_CONNECTED,
    not_selected: ERROR_MESSAGES.GOOGLE_ADS.DASHBOARD_GUIDANCE_NOT_SELECTED,
    auth_expired: ERROR_MESSAGES.GOOGLE_ADS.DASHBOARD_GUIDANCE_AUTH_EXPIRED,
    admin_required: ERROR_MESSAGES.GOOGLE_ADS.DASHBOARD_GUIDANCE_UNKNOWN,
    unknown: ERROR_MESSAGES.GOOGLE_ADS.DASHBOARD_GUIDANCE_UNKNOWN,
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Google Ads パフォーマンス
          </h1>
          <p className="text-gray-500">連携済みアカウントの広告パフォーマンス概要</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled>
            期間: 過去30日間
          </Button>
        </div>
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>データ取得に失敗しました</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{errorMessage}</p>
            <p className="text-sm">{errorGuidance[errorKind]}</p>
            <div className="pt-2">
              <Button asChild variant="outline">
                <a href="/setup/google-ads">
                  {errorKind === 'not_selected' ? 'アカウント選択へ' : 'Google Ads 連携設定へ'}
                </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* データがない場合 */}
      {!hasData && !hasError && (
        <div className="text-center py-12 text-gray-500">
          <p>表示できるデータがありません</p>
        </div>
      )}

      {/* Metrics Cards */}
      {hasData && <MetricsCards summary={summary} />}

      {/* Campaigns Table */}
      {hasData && <CampaignsTable campaigns={campaigns} />}
    </div>
  );
}
