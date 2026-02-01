import { NextResponse } from 'next/server';
import { GoogleAdsService } from '@/server/services/googleAdsService';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';
import {
  ensureGoogleAdsAuth,
  refreshGoogleAdsTokenIfNeeded,
} from '@/server/lib/google-auth';

/**
 * アクセス可能なGoogle Adsアカウント一覧を取得
 */
export async function GET() {
  try {
    // 認証・権限チェックと認証情報取得
    const authResult = await ensureGoogleAdsAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const { userId, credential } = authResult;

    // デバッグ: 認証情報をログに出力（本番環境ではPIIを除外）
    if (process.env.NODE_ENV === 'development') {
      console.log('Google Ads認証情報:', {
        googleAccountEmail: credential.googleAccountEmail,
        userId,
        hasAccessToken: !!credential.accessToken,
        hasRefreshToken: !!credential.refreshToken,
      });
    }

    // アクセストークンが期限切れの場合はリフレッシュ
    const tokenResult = await refreshGoogleAdsTokenIfNeeded(userId, credential);
    if (!tokenResult.success) {
      return tokenResult.response;
    }
    const accessToken = tokenResult.accessToken;

    // アカウント一覧を取得
    const googleAdsService = new GoogleAdsService();
    // デバッグ: API呼び出し情報をログに出力（本番環境ではPIIを除外）
    if (process.env.NODE_ENV === 'development') {
      console.log('Google Ads API呼び出し:', {
        googleAccountEmail: credential.googleAccountEmail,
        accessTokenLength: accessToken.length,
        developerTokenSet: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      });
    } else {
      // 本番環境ではPIIを含まないログのみ出力
      console.log('Google Ads API呼び出し:', {
        accessTokenLength: accessToken.length,
        developerTokenSet: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      });
    }
    try {
      const customerIds = await googleAdsService.listAccessibleCustomers(accessToken);

      // MCCアカウントを特定（managerCustomerId があればそれを優先、次に customerId）
      const mccCustomerId =
        authResult.credential.managerCustomerId ||
        authResult.credential.customerId ||
        customerIds[0] ||
        null;

      // デバッグログ: MCCアカウントの特定状況を確認
      console.log('[Google Ads] MCC specification:', {
        managerCustomerId: authResult.credential.managerCustomerId || '(not set)',
        credentialCustomerId: authResult.credential.customerId || '(not set)',
        firstAccessibleCustomer: customerIds[0] || '(empty)',
        resolvedMccCustomerId: mccCustomerId || '(null)',
        accessibleCustomerCount: customerIds.length,
        allAccessibleCustomers: customerIds,
      });

      // 各アカウントの表示名を取得（失敗した場合はIDをそのまま表示名として使用）
      const accounts = await Promise.all(
        customerIds.map(async id => {
          let displayName = id;
          try {
            // MCCアカウント自体の場合は login-customer-id なし、子アカウントの場合は login-customer-id を指定
            const loginCustomerId = mccCustomerId && id !== mccCustomerId ? mccCustomerId : null;
            const name = await googleAdsService.getCustomerDisplayName(
              id,
              accessToken,
              loginCustomerId
            );
            
            if (name) {
              displayName = name;
            }
          } catch (nameError) {
            // 403エラー（CUSTOMER_NOT_ENABLED）などは無視して、IDをそのまま使用
            console.warn('Failed to resolve Google Ads customer display name', {
              customerId: id,
              error:
                nameError instanceof Error ? nameError.message : String(nameError),
            });
          }

          return {
            customerId: id,
            displayName,
          };
        })
      );

      return NextResponse.json({
        accounts,
      });
    } catch (apiError) {
      // NOT_ADS_USERエラーの場合は専用のエラーメッセージを返す
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      if (errorMessage.includes('Google Adsアカウントと関連付けられていません')) {
        return NextResponse.json(
          { error: ERROR_MESSAGES.GOOGLE_ADS.NOT_ADS_USER },
          { status: 400 }
        );
      }
      // その他のエラーは再スローして下のcatchブロックで処理
      throw apiError;
    }
  } catch (error) {
    console.error('Error fetching Google Ads accounts:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // NOT_ADS_USERエラーの場合は専用のエラーメッセージを返す
    if (errorMessage.includes('Google Adsアカウントと関連付けられていません')) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.GOOGLE_ADS.NOT_ADS_USER },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: ERROR_MESSAGES.GOOGLE_ADS.ACCOUNT_LIST_FETCH_FAILED_SELECT },
      { status: 500 }
    );
  }
}
