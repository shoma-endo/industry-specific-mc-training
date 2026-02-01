import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber, formatCurrency, formatPercent } from '@/lib/utils';
import type { GoogleAdsCampaignMetrics } from '@/types/googleAds.types';

interface CampaignsTableProps {
  campaigns: GoogleAdsCampaignMetrics[];
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>キャンペーン一覧</CardTitle>
        <CardDescription>取得されたキャンペーンデータがここに表示されます。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>キャンペーン名</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead className="text-right">クリック数</TableHead>
                <TableHead className="text-right">表示回数</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">CPC</TableHead>
                <TableHead className="text-right">費用</TableHead>
                <TableHead className="text-right">CV数</TableHead>
                <TableHead className="text-right">CVR</TableHead>
                <TableHead className="text-right">CPA</TableHead>
                <TableHead className="text-right">検索IS（インプレッションシェア）</TableHead>
                <TableHead className="text-right">品質スコア</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.campaignName}>
                  <TableCell className="font-medium">{campaign.campaignName}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        campaign.status === 'ENABLED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {campaign.status === 'ENABLED' ? '有効' : '一時停止'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatNumber(campaign.clicks)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatNumber(campaign.impressions)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatPercent(campaign.ctr)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {campaign.cpc > 0 ? formatCurrency(campaign.cpc) : '-'}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatCurrency(campaign.cost)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{campaign.conversions}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatPercent(campaign.conversionRate)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {campaign.costPerConversion ? formatCurrency(campaign.costPerConversion) : '-'}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatPercent(campaign.searchImpressionShare)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {campaign.qualityScore !== null ? (
                      <span
                        className={`font-medium ${
                          campaign.qualityScore >= 7
                            ? 'text-green-600'
                            : campaign.qualityScore >= 5
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }`}
                      >
                        {campaign.qualityScore}/10
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
