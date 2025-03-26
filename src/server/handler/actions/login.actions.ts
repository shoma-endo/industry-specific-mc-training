"use server"

import {  LineAuthService} from "@/server/services/lineAuthService";

const lineAuthService = new LineAuthService()

export const verifyLineTokenServer = async (
  accessToken: string
): Promise<void> => {
  lineAuthService.verifyLineToken(accessToken)
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
  const profile = await lineAuthService.getLineProfile(accessToken)
  console.log("profile.back", profile)
  return profile
}