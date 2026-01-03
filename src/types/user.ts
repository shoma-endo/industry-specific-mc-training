import { parseTimestamp, parseTimestampOrNull, toIsoTimestamp } from '@/lib/timestamps';
import type { Database } from '@/types/database.types';

/**
 * ユーザーロールの型定義
 */
export type UserRole = 'trial' | 'paid' | 'admin' | 'unavailable' | 'owner';

/**
 * 有効なUserRole値の配列
 */
export const VALID_USER_ROLES: readonly UserRole[] = [
  'trial',
  'paid',
  'admin',
  'unavailable',
  'owner',
] as const;

/**
 * 型ガード: 値が有効なUserRoleかどうかを実行時検証
 */
export function isValidUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (VALID_USER_ROLES as readonly string[]).includes(role);
}

/**
 * 管理機能（設定・コンテンツ一覧）へのアクセスを許可するロール
 */
export const PAID_FEATURE_ROLES = ['paid', 'admin'] as const;

export type PaidFeatureRole = (typeof PAID_FEATURE_ROLES)[number];

export function hasPaidFeatureAccess(role: UserRole | null): role is PaidFeatureRole {
  return role === 'paid' || role === 'admin';
}

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
  role: UserRole; // ユーザーロール（trial: お試し, paid: 有料契約, admin: 管理者, unavailable: サービス利用不可, owner: スタッフを持つあなた）
  ownerUserId?: string | null | undefined; // スタッフが紐づくあなたのID（あなた自身はNULL）
  ownerPreviousRole?: UserRole | null | undefined; // owner化前のロール（復帰用）
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
export type DbUser = Database['public']['Tables']['users']['Row'];

/**
 * アプリケーションモデルとデータベースモデル間の変換関数
 */
export function toDbUser(user: User): DbUser {
  const createdAt = toIsoTimestamp(user.createdAt);
  const updatedAt = toIsoTimestamp(user.updatedAt);
  const lastLoginAt = user.lastLoginAt !== undefined ? toIsoTimestamp(user.lastLoginAt) : null;
  return {
    id: user.id,
    created_at: createdAt,
    updated_at: updatedAt,
    last_login_at: lastLoginAt,
    full_name: user.fullName ?? null,
    line_user_id: user.lineUserId,
    line_display_name: user.lineDisplayName,
    line_picture_url: user.linePictureUrl ?? null,
    line_status_message: user.lineStatusMessage ?? null,
    stripe_customer_id: user.stripeCustomerId ?? null,
    stripe_subscription_id: user.stripeSubscriptionId ?? null,

    role: user.role,
    owner_user_id: user.ownerUserId ?? null,
    owner_previous_role: user.ownerPreviousRole ?? null,
  };
}

export function toUser(dbUser: DbUser): User {
  if (!isValidUserRole(dbUser.role)) {
    throw new Error(`Invalid user role: ${dbUser.role}`);
  }
  const role = dbUser.role;

  // ownerPreviousRoleのバリデーション（null/undefined以外の場合）
  if (dbUser.owner_previous_role != null && !isValidUserRole(dbUser.owner_previous_role)) {
    throw new Error(`Invalid owner previous role: ${dbUser.owner_previous_role}`);
  }

  const createdAt = parseTimestamp(dbUser.created_at);
  const updatedAt = parseTimestamp(dbUser.updated_at);
  const lastLoginAt = parseTimestampOrNull(dbUser.last_login_at);
  return {
    id: dbUser.id,
    createdAt,
    updatedAt,
    lastLoginAt: lastLoginAt === null || Number.isNaN(lastLoginAt) ? undefined : lastLoginAt,
    fullName: dbUser.full_name ?? undefined,
    lineUserId: dbUser.line_user_id,
    lineDisplayName: dbUser.line_display_name,
    linePictureUrl: dbUser.line_picture_url ?? undefined,
    lineStatusMessage: dbUser.line_status_message ?? undefined,
    stripeCustomerId: dbUser.stripe_customer_id ?? undefined,
    stripeSubscriptionId: dbUser.stripe_subscription_id ?? undefined,

    role,
    ownerUserId: dbUser.owner_user_id,
    ownerPreviousRole: dbUser.owner_previous_role ?? null,
  };
}

export interface EmployeeInvitation {
  id: string;
  ownerUserId: string;
  invitationToken: string;
  expiresAt: number;
  usedAt?: number | undefined;
  usedByUserId?: string | undefined;
  createdAt: number;
}
