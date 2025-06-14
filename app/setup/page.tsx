import SetupPageClient from '@/components/SetupPageClient';
import { getWordPressSettings } from '@/server/handler/actions/sanity.action';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  
  if (!liffAccessToken) {
    return <div>ログインしてください</div>;
  }

  // WordPress設定をチェック（WordPress.comとセルフホスト両対応）
  let hasWordPressSettings = false;
  let wordpressSettings = null;
  try {
    wordpressSettings = await getWordPressSettings(liffAccessToken);
    hasWordPressSettings = !!(
      wordpressSettings &&
      (wordpressSettings.wpSiteId || // WordPress.com
       wordpressSettings.wpSiteUrl)  // セルフホスト
    );
  } catch (error) {
    // エラーの場合はhasWordPressSettingsはfalseのまま
    console.log('WordPress設定の取得でエラー:', error);
  }

  // クライアントサイドコンポーネントにWordPress設定の有無と種類を渡す
  return (
    <SetupPageClient 
      liffAccessToken={liffAccessToken}
      hasWordPressSettings={hasWordPressSettings}
      {...(wordpressSettings?.wpType && { wordpressType: wordpressSettings.wpType })}
    />
  );
}