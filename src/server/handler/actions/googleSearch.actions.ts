import { z } from 'zod'
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { userService } from '@/server/services/userService';

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
  const { liffAccessToken, query } = googleSearchSchema.parse(data)

  // 認証チェック（サブスクリ不要なら省略可）
  const auth = await authMiddleware(liffAccessToken)
  if (auth.error) {
    return { items: [], error: auth.error }
  }

  // 環境変数からキー／検索エンジンIDを取得
  const key = process.env.GOOGLE_CUSTOM_SEARCH_KEY!
  const cx  = process.env.GOOGLE_CSE_ID!

  const url = new URL('https://customsearch.googleapis.com/customsearch/v1')
  url.searchParams.set('key', key)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', query)
  url.searchParams.set('num', '3')    // 上位3件
  url.searchParams.set('start', '1')   // 1位〜10位
  url.searchParams.set('gl', 'jp')     // 日本の地域
  url.searchParams.set('lr', 'lang_ja')  // 日本語ページ

  const res  = await fetch(url.toString())
  if (!res.ok) {
    return { items: [], error: `Google API Error ${res.status}` }
  }

  const json = await res.json()
  const items = (json.items || []).map((i: { title: string; snippet: string; link: string }) => ({
    title:   i.title,
    snippet: i.snippet,
    link:    i.link,
  }))

  // Google Search API利用回数をインクリメント
  if (auth.user) {
    await userService.incrementGoogleSearchCount(auth.user.id)
  }

  return { items }
}
