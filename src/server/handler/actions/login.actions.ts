"use server"

import {  LineAuthService} from "@/server/services/lineAuthService";
import { cookies } from 'next/headers';
const lineAuthService = new LineAuthService()

export const verifyLineTokenServer = async (
  accessToken: string
): Promise<void> => {
  await lineAuthService.verifyLineToken(accessToken)

  // verify成功したら、クッキーに保存する
  const cookieStore = await cookies();
  cookieStore.set('line_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1日
  });
}

export interface getLineProfileServerResponse {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

export const getLineProfileServer = async (
  accessToken: string
): Promise<getLineProfileServerResponse> => {
  const profile = await lineAuthService.getLineProfile(accessToken)
  console.log("profile.back", profile)
  return profile
}