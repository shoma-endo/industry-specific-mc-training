'use server';

import { LineAuthService } from '@/server/services/lineAuthService';

import { setAuthCookies } from '@/server/middleware/auth.middleware';
const lineAuthService = new LineAuthService();

export const verifyLineTokenServer = async (accessToken: string): Promise<void> => {
  // 1. トークン検証
  await lineAuthService.verifyLineToken(accessToken);

  // 2. verify成功したら、クッキーに保存する（ユーザー作成/更新は `/api/user/current` 側で実施）
  await setAuthCookies(accessToken);
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
