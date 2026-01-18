'use server';

import { LineAuthService } from '@/server/services/lineAuthService';

const lineAuthService = new LineAuthService();

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
