import { landingPageBySlugQuery } from '@/lib/queries';
import { cookies } from 'next/headers';
import { getSanityClient } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LandingPageData = {
  hero: { title: string; subtitle: string; backgroundImageUrl: string };
  features: { title: string; description: string; icon: string }[] | null;
  samples: { url: string; imageUrl: string; title: string }[] | null;
  ctaForm: {
    heading: string;
    description: string;
    fields: string[];
    submitLabel: string;
  } | null;
  faq: { question: string; answer: string }[] | null;
  footerLinks: { label: string; url: string }[] | null;
};

async function getSanityClientFromCookie() {
  const cookieStore = await cookies();
  const lineAccessToken = cookieStore.get('line_access_token')?.value;
  if (!lineAccessToken) notFound();
  return getSanityClient(lineAccessToken);
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) notFound();

  const userSanityClient = await getSanityClientFromCookie();
  const data = await userSanityClient.fetch<LandingPageData>(landingPageBySlugQuery, { slug });

  if (!data || !data.hero) return <p>コンテンツが見つかりません</p>;

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
              <Image src={sample.imageUrl} alt={sample.title} width={400} height={250} />
              <div className="p-4">{sample.title}</div>
            </a>
          ))}
        </div>
      </section>

      {/* CTA Form */}
      {data.ctaForm && (
        <section className="bg-gray-100 p-8 rounded">
          <h2 className="text-2xl font-bold mb-2">{data.ctaForm.heading}</h2>
          <p className="mb-4">{data.ctaForm.description}</p>
          <form className="space-y-4">
            {(data.ctaForm.fields ?? []).map((field, i) => (
              <input key={i} type="text" placeholder={field} className="w-full p-2 border rounded" />
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
          {(data.footerLinks ?? []).map((link, i) => (
            <Link href={link.url} key={i} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}
