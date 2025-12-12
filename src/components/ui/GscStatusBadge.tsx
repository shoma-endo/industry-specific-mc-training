import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface GscStatusBadgeProps {
  connected: boolean;
  needsReauth: boolean;
}

/**
 * Google Search Console のステータスバッジコンポーネント
 *
 * 優先度：再認証 > 接続済み > 未設定
 */
export function GscStatusBadge({ connected, needsReauth }: GscStatusBadgeProps) {
  // 再認証が必要な場合は「要再認証」バッジを表示
  if (needsReauth) {
    return (
      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">
        <AlertTriangle className="mr-1 h-4 w-4" />
        要再認証
      </Badge>
    );
  }
  if (connected) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
        <CheckCircle2 className="mr-1 h-4 w-4" />
        接続済み
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-gray-700">
      <AlertCircle className="mr-1 h-4 w-4" />
      未設定
    </Badge>
  );
}
