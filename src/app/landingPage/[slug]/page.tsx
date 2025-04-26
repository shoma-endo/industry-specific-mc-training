import { sanityClient } from '@/lib/sanity.client';
import { landingPageBySlugQuery } from '@/lib/queries';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ParsedUrlQuery } from 'querystring';

// 常に最新のデータを取得する（SSR）
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 型定義
type LandingPageData = {
  hero: { title: string; subtitle: string; backgroundImageUrl: string };
  features: { title: string; description: string; icon: string }[];
  samples: { url: string; imageUrl: string; title: string }[];
  ctaForm: { heading: string; description: string; fields: string[]; submitLabel: string };
  faq: { question: string; answer: string }[];
  footerLinks: { label: string; url: string }[];
};

// PageProps に合わせて params と searchParams を受け取ります（searchParams は未使用）
export default async function LandingPage({
  params,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  searchParams: _searchParams,
}: {
  params: { slug: string };
  searchParams?: ParsedUrlQuery;
}) {
  const slug = params.slug;
  if (!slug) {
    notFound(); // Next.js 404 を返す
  }
  const data = await sanityClient.fetch<LandingPageData>(landingPageBySlugQuery, { slug });
  if (!data) {
    return <p>コンテンツが見つかりません</p>;
  }

  return (
    <main className="container mx-auto px-4 py-12 space-y-16">
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
          {data.features?.map((feature, i) => (
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
          {data.samples?.map((sample, i) => (
            <a
              href={sample.url}
              key={i}
              target="_blank"
              className="block border rounded overflow-hidden hover:shadow-lg"
            >
              <Image src={sample.imageUrl} alt={sample.title} width={400} height={250} />
              <div className="p-4">{sample.title}</div>
            </a>
          ))}
        </div>
      </section>

      {/* CTA Form */}
      <section className="bg-gray-100 p-8 rounded">
        <h2 className="text-2xl font-bold mb-2">{data.ctaForm?.heading}</h2>
        <p className="mb-4">{data.ctaForm?.description}</p>
        <form className="space-y-4">
          {data.ctaForm?.fields.map((field, i) => (
            <input key={i} type="text" placeholder={field} className="w-full p-2 border rounded" />
          ))}
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            {data.ctaForm?.submitLabel}
          </button>
        </form>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-center">よくある質問</h2>
        <div className="space-y-4">
          {data.faq?.map((item, i) => (
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
          {data.footerLinks?.map((link, i) => (
            <Link href={link.url} key={i} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}
