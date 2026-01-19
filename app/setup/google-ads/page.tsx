import { Suspense } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';
import { getGoogleAdsConnectionStatus } from '@/server/actions/googleAds.actions';

// エラーコードとメッセージのマッピング
const ERROR_MAP: Record<string, string> = {
  auth_failed: ERROR_MESSAGES.GOOGLE_ADS.AUTH_FAILED,
  missing_params: ERROR_MESSAGES.GOOGLE_ADS.MISSING_PARAMS,
  invalid_state: ERROR_MESSAGES.GOOGLE_ADS.INVALID_STATE,
  state_cookie_mismatch: ERROR_MESSAGES.GOOGLE_ADS.STATE_COOKIE_MISMATCH,
  state_user_mismatch: ERROR_MESSAGES.GOOGLE_ADS.STATE_USER_MISMATCH,
  state_expired: ERROR_MESSAGES.GOOGLE_ADS.STATE_EXPIRED,
  invalid_state_signature: ERROR_MESSAGES.GOOGLE_ADS.INVALID_CREDENTIALS,
  invalid_state_format: ERROR_MESSAGES.GOOGLE_ADS.INVALID_CREDENTIALS,
  invalid_state_payload: ERROR_MESSAGES.GOOGLE_ADS.INVALID_CREDENTIALS,
  server_error: ERROR_MESSAGES.GOOGLE_ADS.SERVER_ERROR,
};

// サーバーコンポーネント
async function GoogleAdsSetupContent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const success = searchParams.success === 'true';
  const error = typeof searchParams.error === 'string' ? searchParams.error : undefined;

  // エラーメッセージの解決
  const errorMessage = error
    ? ERROR_MAP[error] || error || ERROR_MESSAGES.GOOGLE_ADS.UNKNOWN_ERROR
    : null;

  // DB から連携状態を取得
  const connectionStatus = await getGoogleAdsConnectionStatus();
  const isConnected = connectionStatus.connected;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/setup"
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          設定に戻る
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Google Ads 連携設定</h1>
        <p className="text-gray-600">
          Google Ads アカウントと連携し、広告パフォーマンスデータを取得します。
        </p>
      </div>

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-800 font-medium">連携完了</AlertTitle>
          <AlertDescription className="text-green-700">
            Google Ads アカウントとの連携が完了しました。
            {connectionStatus.googleAccountEmail && (
              <span className="block mt-1">
                連携アカウント: {connectionStatus.googleAccountEmail}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!success && isConnected && (
        <Alert className="bg-blue-50 border-blue-200">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-800 font-medium">連携済み</AlertTitle>
          <AlertDescription className="text-blue-700">
            Google Ads アカウントと連携済みです。
            {connectionStatus.googleAccountEmail && (
              <span className="block mt-1">
                連携アカウント: {connectionStatus.googleAccountEmail}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>連携エラー</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Google Ads アカウント連携</CardTitle>
          <CardDescription>
            「連携する」ボタンを押すとGoogleの認証画面に移動します。
            広告データの読み取り権限を許可してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100">
            <p className="font-semibold mb-1">データ利用について</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                広告キャンペーン、クリック数、コンバージョン数などのパフォーマンスデータを取得・分析します。
              </li>
              <li>取得したデータは、AIによる広告改善提案の生成のみに使用されます。</li>
              <li>
                本サービスがGoogle Adsの設定を自動で変更したり、広告を出稿することはありません。
              </li>
            </ul>
          </div>

          <a
            href="/api/google-ads/oauth/start"
            className="inline-flex items-center justify-center w-full rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
          >
            {isConnected ? 'Google Ads を再連携する' : 'Google Ads と連携する'}
          </a>

          {isConnected && (
            <p className="text-xs text-center text-gray-500">
              ※ 連携を解除する場合は、Google
              アカウントの「アカウントにアクセスできるアプリ」から削除してください。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function GoogleAdsSetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;

  if (!liffAccessToken) {
    redirect('/login');
  }

  const authResult = await authMiddleware(liffAccessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    redirect('/login');
  }

  const resolvedParams = searchParams ? await searchParams : {};

  return (
    <div className="container mx-auto py-10 px-4">
      <Suspense fallback={<div>Loading...</div>}>
        <GoogleAdsSetupContent searchParams={resolvedParams} />
      </Suspense>
    </div>
  );
}
