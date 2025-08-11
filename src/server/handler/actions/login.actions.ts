'use server';

import { LineAuthService } from '@/server/services/lineAuthService';
import { cookies } from 'next/headers';
const lineAuthService = new LineAuthService();

export const verifyLineTokenServer = async (accessToken: string): Promise<void> => {
  // 1. トークン検証
  await lineAuthService.verifyLineToken(accessToken);

  // 2. verify成功したら、クッキーに保存する（ユーザー作成/更新は `/api/user/current` 側で実施）
  const cookieStore = await cookies();
  cookieStore.set('line_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 3, // 3日
  });
};

export const setRefreshTokenCookie = async (refreshToken: string): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.set('line_refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30日
  });
};

export interface getLineProfileServerResponse {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export const getLineProfileServer = async (
  accessToken: string
): Promise<getLineProfileServerResponse> => {
  const profile = await lineAuthService.getLineProfile(accessToken);
  return profile;
};
