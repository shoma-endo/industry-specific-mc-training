import { z } from 'zod'
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { userService } from '@/server/services/userService';

/**
 * Google検索アクション: キーワードで検索を実行し、結果を返す
 * 検索成功時のみカウントをインクリメントする
 */

export const googleSearchSchema = z.object({
  liffAccessToken: z.string(),
  query:            z.string(),
})

export type GoogleSearchResult = {
  title:   string
  snippet: string
  link:    string
}

export async function googleSearchAction(
  data: z.infer<typeof googleSearchSchema>
): Promise<{ items: GoogleSearchResult[]; error?: string }> {
  try {
    const { liffAccessToken, query } = googleSearchSchema.parse(data)

    // 早期リターン: 認証チェック
    const auth = await authMiddleware(liffAccessToken)
    if (auth.error) {
      return { items: [], error: auth.error }
    }

    // 早期リターン: ユーザー情報チェック
    if (!auth.user) {
      return { items: [], error: 'User not found' }
    }

    // 早期リターン: 環境変数チェック
    const key = process.env.GOOGLE_CUSTOM_SEARCH_KEY
    const cx = process.env.GOOGLE_CSE_ID
    if (!key || !cx) {
      return { items: [], error: 'Google API configuration missing' }
    }

    const url = new URL('https://customsearch.googleapis.com/customsearch/v1')
    url.searchParams.set('key', key)
    url.searchParams.set('cx', cx)
    url.searchParams.set('q', query)
    url.searchParams.set('num', '3')
    url.searchParams.set('start', '1')
    url.searchParams.set('gl', 'jp')
    url.searchParams.set('lr', 'lang_ja')

    const res = await fetch(url.toString())
    
    // 早期リターン: API応答エラー
    if (!res.ok) {
      console.error(`Google API Error: ${res.status} - ${res.statusText}`)
      // 検索失敗でもカウントはインクリメントしない
      return { items: [], error: `Google API Error ${res.status}` }
    }

    const json = await res.json()
    const items = (json.items || []).map((i: { title: string; snippet: string; link: string }) => ({
      title: i.title,
      snippet: i.snippet,
      link: i.link,
    }))

    // 成功時のみGoogle Search API利用回数をインクリメント
    try {
      await userService.incrementGoogleSearchCount(auth.user.id)
    } catch (incrementError) {
      // カウント更新失敗は検索結果に影響させない
      console.error('Failed to increment search count:', incrementError)
    }

    return { items }
  } catch (error) {
    console.error('Google search action error:', error)
    return { items: [], error: 'Internal server error' }
  }
}
