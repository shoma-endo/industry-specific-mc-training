import type { EmployeeInvitation } from '@/types/user';

const INVITATION_EXPIRY_DAYS = 7;

/**
 * 招待トークンを生成（Edge Runtime対応のためWeb Crypto APIを使用）
 */
export async function generateInvitationToken(): Promise<string> {
  // Web Crypto APIを使用（Edge Runtime対応）
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  // base64urlエンコード
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function generateExpiresAt(): number {
  return Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}

// TODO: 招待ステータス取得API（/api/employee/invite/status）を用意してUIロジックを簡略化する
export function isInvitationValid(invitation: EmployeeInvitation): boolean {
  return invitation.usedAt == null && invitation.expiresAt > Date.now();
}
