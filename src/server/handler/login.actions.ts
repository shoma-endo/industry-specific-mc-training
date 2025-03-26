"use server"

import { LoginService } from "@/server/services/lineAuthService"

const loginService = new LoginService()

export const verifyLineTokenServer = async (
  accessToken: string
): Promise<void> => {
  loginService.verifyLineToken(accessToken)
}

export interface getLineProfileServerResponse {
  userId: string
  displayName: string
  pictureUrl: string
  language: string
  statusMessage?: string
}

export const getLineProfileServer = async (
  accessToken: string
): Promise<getLineProfileServerResponse> => {
  const profile = await loginService.getLineProfile(accessToken)
  console.log("profile.back", profile)
  return profile
}