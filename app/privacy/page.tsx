import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            asChild
            className="pl-0 hover:bg-transparent hover:text-blue-600 text-gray-600"
          >
            <Link href="/home" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              トップページに戻る
            </Link>
          </Button>
        </div>

        <article className="bg-white shadow-sm rounded-2xl p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 border-b pb-4">
            プライバシーポリシー
          </h1>

          <div className="prose prose-blue max-w-none space-y-8 text-gray-700">
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">1. はじめに</h2>
              <p>
                「業界特化MC養成講座」（以下、「当サービス」といいます）は、ユーザーの個人情報の保護を重視しています。
                本プライバシーポリシーは、当サービスが収集する情報、その使用方法、および共有方法について説明するものです。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">2. 収集する情報</h2>
              <p className="mb-2">当サービスは、以下の情報を収集する場合があります：</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>アカウント情報：</strong>{' '}
                  LINEログインを通じて取得される名前、プロフィール画像、ユーザーID。
                </li>
                <li>
                  <strong>Googleユーザーデータ：</strong> ユーザーの同意に基づき、Google Search
                  Console
                  APIを通じて取得されるデータ（検索クエリ、クリック数、表示回数、掲載順位など）。
                </li>
                <li>
                  <strong>利用状況データ：</strong>{' '}
                  サービスの利用履歴、生成されたコンテンツ、ログデータ。
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                3. Googleユーザーデータの利用目的
              </h2>
              <p className="mb-2">当サービスは、以下のGoogle APIスコープを使用します：</p>
              <ul className="list-disc pl-5 space-y-1 mb-4">
                <li>
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                    https://www.googleapis.com/auth/webmasters.readonly
                  </code>{' '}
                  （Google Search Console - 読み取り専用）
                </li>
              </ul>
              <p className="mb-2">
                このスコープを使用して、Google Search Console
                APIから取得したデータを以下の目的でのみ使用します：
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>ユーザーのウェブサイトの検索パフォーマンス（SEO）を分析するため。</li>
                <li>
                  分析データに基づき、記事の改善提案や新しいコンテンツのアイデアをAIにより生成するため。
                </li>
                <li>マーケティング戦略の立案を支援するため。</li>
              </ul>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-4 text-sm text-blue-900">
                <strong>重要：</strong>{' '}
                当サービスがGoogleユーザーデータを第三者に販売したり、広告目的で使用したりすることはありません。
                また、取得したデータは上記の機能提供のためにのみ使用され、ユーザーの許可なくAIモデルの学習データとして共有されることはありません。
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">4. データの共有と開示</h2>
              <p>
                当サービスは、法令に基づく場合や、ユーザーの明示的な同意がある場合を除き、個人情報を第三者と共有することはありません。
                ただし、サービスの提供に必要な範囲で、信頼できる第三者サービスプロバイダー（クラウドホスティング、決済処理業者など）に業務を委託する場合があります。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">5. データの保護</h2>
              <p>
                当サービスは、業界標準のセキュリティ対策を講じて、ユーザーの情報の紛失、盗用、悪用、不正アクセス、開示、改ざん、破壊を防止します。
                すべての通信はSSL/TLS暗号化技術を使用して保護されています。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">6. データの保持期間</h2>
              <p>
                Google Search Console
                APIから取得したデータは、サービス提供に必要な期間のみ保持します。
                ユーザーがアカウントを削除した場合、または連携を解除した場合は、30日以内に関連するすべてのデータを削除します。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                7. プライバシーポリシーの変更
              </h2>
              <p>
                当サービスは、必要に応じて本プライバシーポリシーを更新することがあります。
                変更があった場合は、本ページ上で通知し、重要な変更についてはより目立つ方法で通知します。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-3">8. お問い合わせ</h2>
              <p>
                本プライバシーポリシーに関するご質問や懸念がある場合は、以下の連絡先までお問い合わせください。
              </p>
              <p className="mt-2 font-medium">
                お問い合わせ窓口: support@industry-mc-training.com
                <br />
                （※実際のお問い合わせ先をご記入ください）
              </p>
            </section>
          </div>
        </article>

        <div className="mt-8 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Industry Specific MC Training. All rights reserved.
        </div>
      </div>
    </div>
  );
}
