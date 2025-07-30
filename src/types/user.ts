/**
 * ユーザーロールの型定義
 */
export type UserRole = 'user' | 'admin';

/**
 * ユーザー情報の型定義
 */
export interface User {
  // 基本情報
  id: string; // ユーザーID (Supabaseの自動生成ID等)
  createdAt: number; // ユーザー作成日時 (タイムスタンプ)
  updatedAt: number; // 最終更新日時 (タイムスタンプ)
  lastLoginAt?: number | undefined; // 最終ログイン日時 (タイムスタンプ)
  fullName?: string | undefined; // フルネーム

  // LINE関連情報
  lineUserId: string; // LINE UserID
  lineDisplayName: string; // LINE表示名
  linePictureUrl?: string | undefined; // LINEプロフィール画像URL
  lineStatusMessage?: string | undefined; // LINEステータスメッセージ
  lineAccessToken?: string | undefined; // LINEアクセストークン (一時的)

  // Stripe関連情報
  stripeCustomerId?: string | undefined; // StripeカスタマーID
  stripeSubscriptionId?: string | undefined; // Stripeサブスクリプション ID

  // 権限管理
  role: UserRole; // ユーザーロール（user: 一般ユーザー, admin: 管理者）
}

/**
 * サブスクリプション状態の列挙型
 * クライアントサイドでのみ使用（Stripe APIから取得）
 */
export enum SubscriptionStatus {
  NONE = 'none', // サブスクリプションなし
  ACTIVE = 'active', // アクティブ
  CANCELED = 'canceled', // キャンセル済み
  PAST_DUE = 'past_due', // 支払い遅延
  UNPAID = 'unpaid', // 未払い
  TRIAL = 'trial', // 試用期間中
  INCOMPLETE = 'incomplete', // 不完全
  INCOMPLETE_EXPIRED = 'incomplete_expired', // 不完全期限切れ
}

/**
 * データベースモデルへの変換用インターフェース
 */
export interface DbUser {
  id: string;
  created_at: number;
  updated_at: number;
  last_login_at?: number | undefined;
  full_name?: string | undefined;
  line_user_id: string;
  line_display_name: string;
  line_picture_url?: string | undefined;
  line_status_message?: string | undefined;
  stripe_customer_id?: string | undefined;
  stripe_subscription_id?: string | undefined;

  role: UserRole;
}

/**
 * アプリケーションモデルとデータベースモデル間の変換関数
 */
export function toDbUser(user: User): DbUser {
  return {
    id: user.id,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    last_login_at: user.lastLoginAt,
    full_name: user.fullName,
    line_user_id: user.lineUserId,
    line_display_name: user.lineDisplayName,
    line_picture_url: user.linePictureUrl,
    line_status_message: user.lineStatusMessage,
    stripe_customer_id: user.stripeCustomerId,
    stripe_subscription_id: user.stripeSubscriptionId,

    role: user.role,
  };
}

export function toUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
    lastLoginAt: dbUser.last_login_at,
    fullName: dbUser.full_name,
    lineUserId: dbUser.line_user_id,
    lineDisplayName: dbUser.line_display_name,
    linePictureUrl: dbUser.line_picture_url,
    lineStatusMessage: dbUser.line_status_message,
    stripeCustomerId: dbUser.stripe_customer_id,
    stripeSubscriptionId: dbUser.stripe_subscription_id,

    role: dbUser.role,
  };
}
