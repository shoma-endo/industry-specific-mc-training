import { landingPageByUserAndSlugQuery } from '@/lib/queries';
import { cookies, draftMode } from 'next/headers';
import { getSanityClient, getDraftSanityClient } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { UserService } from '@/server/services/userService';
import { LandingPageData } from '@/types/sanity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// レスポンス型を簡略化（必要なフィールドのみ）
type LandingPageResponse = Pick<
  LandingPageData,
  'hero' | 'features' | 'samples' | 'ctaForm' | 'faq' | 'footerLinks'
>;

export default async function LandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ userId?: string }>;
}) {
  const slug = (await params).slug;

  if (!slug) notFound();

  // Draft Mode の状態を確認
  const { isEnabled: isDraftMode } = await draftMode();

  // 公開サイトはLINEログイン情報からuserIdを取得する
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('line_access_token')?.value;

  if (!accessToken) {
    redirect('/login');
  }

  // Sanityプレビュー用のuserId
  const previewUserId = (await searchParams).userId;

  let userId: string | null = null;

  // プレビューなら userId をそのまま使う
  if (previewUserId) {
    userId = previewUserId;
  } else {
    const userService = new UserService();
    const user = await userService.getUserFromLiffToken(accessToken);

    if (!user) {
      redirect('/login');
    }

    userId = user.id;
  }

  // Draft Mode に応じてクライアントを選択
  const sanityClient = isDraftMode
    ? await getDraftSanityClient(accessToken)
    : await getSanityClient(accessToken);

  const data = await sanityClient.fetch<LandingPageResponse>(landingPageByUserAndSlugQuery, {
    slug,
    userId,
  });

  if (!data || !data.hero) {
    notFound();
  }

  return (
    <>
      {/* Draft Mode インジケーター */}
      {isDraftMode && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black text-center py-2 z-50">
          <span className="font-semibold">🚀 プレビューモード</span>
          <span className="mx-2">|</span>
          <span className="text-sm">下書き内容を表示しています</span>
          <span className="mx-2">|</span>
          <Link href="/api/draft/disable" className="underline hover:no-underline font-medium">
            プレビューを終了
          </Link>
        </div>
      )}

      <main className={`container mx-auto px-4 py-12 space-y-16 ${isDraftMode ? 'mt-12' : ''}`}>
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl font-bold">{data.hero.title}</h1>
          <p className="text-lg">{data.hero.subtitle}</p>
          <Image
            src={data.hero.backgroundImageUrl}
            alt="Hero"
            width={1200}
            height={600}
            className="mx-auto rounded-lg"
          />
        </section>

        {/* Features */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-center">選ばれる理由</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {(data.features ?? []).map((feature, i) => (
              <div key={i} className="border p-4 rounded shadow-sm">
                <div className="text-xl font-semibold">{feature.title}</div>
                <p className="text-gray-700 mt-2">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Samples */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-center">ページサンプル</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {(data.samples ?? []).map((sample, i) => (
              <a
                href={sample.url}
                key={i}
                target="_blank"
                className="block border rounded overflow-hidden hover:shadow-lg"
              >
                {sample.imageUrl ? (
                  <Image
                    src={sample.imageUrl}
                    alt={sample.title}
                    width={400}
                    height={250}
                    className="w-full h-40 object-cover"
                  />
                ) : null}
                <div className="p-4">{sample.title}</div>
              </a>
            ))}
          </div>
        </section>

        {/* CTA */}
        {data.ctaForm && (
          <section className="bg-gray-100 p-8 rounded">
            <h2 className="text-2xl font-bold mb-2">{data.ctaForm.heading}</h2>
            <p className="mb-4">{data.ctaForm.description}</p>
            <form className="space-y-4">
              {(data.ctaForm.fields ?? []).map((field, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={field}
                  className="w-full p-2 border rounded"
                />
              ))}
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
                {data.ctaForm.submitLabel}
              </button>
            </form>
          </section>
        )}

        {/* FAQ */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-center">よくある質問</h2>
          <div className="space-y-4">
            {(data.faq ?? []).map((item, i) => (
              <div key={i} className="border-b pb-4">
                <h3 className="font-semibold">{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t text-center">
          <div className="flex justify-center flex-wrap gap-4 text-sm text-gray-600">
            {(data.footerLinks ?? []).map((link, i) =>
              link.url ? (
                <Link href={link.url} key={i} className="hover:underline">
                  {link.label}
                </Link>
              ) : (
                <span key={i} className="text-gray-400 cursor-not-allowed">
                  {link.label}
                </span>
              )
            )}
          </div>
        </footer>
      </main>
    </>
  );
}
