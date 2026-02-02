import { type NextRequest, NextResponse } from 'next/server';
import { GoogleAdsService } from '@/server/services/googleAdsService';
import { SupabaseService } from '@/server/services/supabaseService';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';
import {
  ensureGoogleAdsAuth,
  refreshGoogleAdsTokenIfNeeded,
} from '@/server/lib/google-auth';

/**
 * 選択されたGoogle AdsアカウントIDを保存
 */
export async function POST(request: NextRequest) {
  try {
    // 認証・権限チェックと認証情報取得
    const authResult = await ensureGoogleAdsAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const { userId, credential } = authResult;

    // リクエストボディから customerId を取得
    let customerId: string | null = null;
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const value = body.customerId;
      if (typeof value === 'string') {
        customerId = value;
      }
    } catch {
      // JSONパース失敗時も400エラーを返す（不正なリクエストボディ）
    }

    if (!customerId) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.GOOGLE_ADS.CUSTOMER_ID_REQUIRED },
        { status: 400 }
      );
    }

    // アクセストークンが期限切れの場合はリフレッシュ
    const tokenResult = await refreshGoogleAdsTokenIfNeeded(userId, credential);
    if (!tokenResult.success) {
      return tokenResult.response;
    }
    const accessToken = tokenResult.accessToken;

    // アクセス可能なアカウント一覧を取得
    const googleAdsService = new GoogleAdsService();
    let accessibleCustomerIds: string[];
    try {
      accessibleCustomerIds = await googleAdsService.listAccessibleCustomers(accessToken);
    } catch (err) {
      console.error('Failed to fetch accessible customers:', err);
      return NextResponse.json(
        { error: ERROR_MESSAGES.GOOGLE_ADS.ACCOUNT_LIST_FETCH_FAILED_SELECT },
        { status: 500 }
      );
    }

    // リクエストされたcustomerIdがアクセス可能なアカウント一覧に含まれるか検証
    if (!accessibleCustomerIds.includes(customerId)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.GOOGLE_ADS.ACCOUNT_ACCESS_DENIED },
        { status: 403 }
      );
    }

    // MCC（マネージャー）アカウントIDを特定
    // customer.manager フィールドで各アカウントがMCCかどうかを判定
    const mccInfoResults = await Promise.all(
      accessibleCustomerIds.map(async id => {
        // 選択されたアカウント自体は MCC 判定の対象外（子アカウントとして利用するため）
        if (id === customerId) return { id, isManager: false };
        try {
          const info = await googleAdsService.getCustomerInfo(id, accessToken);
          return { id, isManager: info?.isManager ?? false };
        } catch {
          // MCC判定失敗は無視（managerCustomerId = null のまま）
          return { id, isManager: false };
        }
      })
    );

    // 競合状態を回避して逐次的にMCCを特定
    let managerCustomerId: string | null = mccInfoResults.find(r => r.isManager)?.id || null;

    // 選択アカウント自身がMCCの場合（MCC直接選択）
    if (!managerCustomerId) {
      try {
        const selfInfo = await googleAdsService.getCustomerInfo(customerId, accessToken);
        if (selfInfo?.isManager) {
          managerCustomerId = customerId;
        }
      } catch {
        // MCC判定失敗は無視
      }
    }

    // customer_id と manager_customer_id を更新
    const supabaseService = new SupabaseService();
    const updateResult = await supabaseService.updateGoogleAdsCustomerId(
      userId,
      customerId,
      managerCustomerId
    );
    if (!updateResult.success) {
      return NextResponse.json(
        { error: updateResult.error.userMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customerId,
    });
  } catch (error) {
    console.error('Error selecting Google Ads account:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.GOOGLE_ADS.ACCOUNT_SELECT_FAILED },
      { status: 500 }
    );
  }
}
