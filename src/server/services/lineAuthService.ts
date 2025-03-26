interface LineProfile {
  userId: string
  displayName: string
  pictureUrl: string
  language: string
  statusMessage?: string
}

export class LoginService {
  verifyLineToken = async (accessToken: string): Promise<void> => {
    try {
      const channelId = process.env.NEXT_PUBLIC_LIFF_CHANNEL_ID
      const response = await fetch(
        `https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`,
        {
          method: "GET",
        }
      )

      console.log("response", response)

      if (!response.ok) {
        const data: { error_description: string; error: string } =
          await response.json()
        throw new Error(
          `[LINE Token Verification] ${data.error}: ${data.error_description}`
        )
      }
      const data: { client_id: string; expires_in: number } =
        await response.json()
      if (data.client_id !== channelId) {
        throw new Error(
          `Line client_id does not match:liffID : ${channelId}  client_id : ${data.client_id}`
        )
      }
      if (data.expires_in < 0) {
        throw new Error(`Line access token is expired: ${data.expires_in}`)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`[LINE Token Verification] ${error.message}`)
      }
      throw new Error("[LINE Token Verification] Unknown error occurred")
    }
  }

  getLineProfile = async (accessToken: string): Promise<LineProfile> => {
    try {
      const response = await fetch("https://api.line.me/v2/profile", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (!response.ok) {
        const data: { error_description: string; error: string } =
          await response.json()
        throw new Error(
          `[LINE Profile Fetch] ${data.error}: ${data.error_description}`
        )
      }
      return response.json() as Promise<LineProfile>
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`[LINE Profile Fetch] ${error.message}`)
      }
      throw new Error("[LINE Profile Fetch] Unknown error occurred")
    }
  }
}
