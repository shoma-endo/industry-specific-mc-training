'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Settings, Database, Plug } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SanitySettings {
  hasSettings: boolean;
  projectId: string | null;
}

interface WordPressSettings {
  hasSettings: boolean;
  type: 'wordpress_com' | 'self_hosted';
  siteId?: string;
  siteUrl?: string;
}

interface Props {
  sanitySettings: SanitySettings;
  wordpressSettings: WordPressSettings;
}

export default function SetupDashboard({ sanitySettings, wordpressSettings }: Props) {
  const router = useRouter();

  const isSetupComplete = sanitySettings.hasSettings && wordpressSettings.hasSettings;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">設定ダッシュボード</h1>
        <p className="text-gray-600">
          ランディングページ作成に必要な設定を管理します
        </p>
      </div>

      {/* 全体のステータス */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {isSetupComplete ? (
              <>
                <CheckCircle className="text-green-500" size={24} />
                <h2 className="text-xl font-semibold text-green-700">設定完了</h2>
              </>
            ) : (
              <>
                <AlertCircle className="text-orange-500" size={24} />
                <h2 className="text-xl font-semibold text-orange-700">設定が必要です</h2>
              </>
            )}
          </div>
          <p className="text-gray-600 mb-4">
            {isSetupComplete
              ? 'すべての設定が完了しています。ランディングページ作成機能をご利用いただけます。'
              : '一部の設定が未完了です。下記の設定項目を確認してください。'}
          </p>
          {isSetupComplete && (
            <div className="flex gap-4">
              <Button onClick={() => router.push('/studio')} variant="outline" className="text-blue-500 flex-1">
                Sanity Studio を開く
              </Button>
              <Button onClick={() => router.push('/ad-form')} variant="outline" className="text-purple-500 flex-1">
                ランディングページ作成へ
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 設定項目カード */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sanity 設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Database className="text-blue-500" size={24} />
              Sanity CMS 設定
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {sanitySettings.hasSettings ? (
                  <>
                    <CheckCircle className="text-green-500" size={20} />
                    <span className="text-green-700 font-medium">設定済み</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="text-orange-500" size={20} />
                    <span className="text-orange-700 font-medium">未設定</span>
                  </>
                )}
              </div>
              
              {sanitySettings.hasSettings && sanitySettings.projectId && (
                <div className="text-sm text-gray-600">
                  <p>プロジェクトID: {sanitySettings.projectId}</p>
                </div>
              )}
              
              <p className="text-sm text-gray-600">
                ランディングページのコンテンツ管理システムです。
                プロジェクトIDとAPIトークンの設定が必要です。
              </p>
              
              <div className="flex gap-2">
                <Link href="/setup/sanity" className="flex-1">
                  <Button variant={sanitySettings.hasSettings ? "outline" : "default"} className="w-full">
                    <Settings size={16} className="mr-2" />
                    {sanitySettings.hasSettings ? '設定を編集' : '設定を開始'}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WordPress 設定 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Plug className="text-purple-500" size={24} />
              WordPress 設定
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {wordpressSettings.hasSettings ? (
                  <>
                    <CheckCircle className="text-green-500" size={20} />
                    <span className="text-green-700 font-medium">設定済み</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="text-orange-500" size={20} />
                    <span className="text-orange-700 font-medium">未設定</span>
                  </>
                )}
              </div>
              
              {wordpressSettings.hasSettings && (
                <div className="text-sm text-gray-600">
                  <p>タイプ: {wordpressSettings.type === 'wordpress_com' ? 'WordPress.com' : 'セルフホスト'}</p>
                  {wordpressSettings.siteId && <p>サイトID: {wordpressSettings.siteId}</p>}
                  {wordpressSettings.siteUrl && <p>サイトURL: {wordpressSettings.siteUrl}</p>}
                </div>
              )}
              
              <p className="text-sm text-gray-600">
                ランディングページの公開先です。
                WordPress.com または セルフホスト版の設定が必要です。
              </p>
              
              <Link href="/setup/wordpress" className="block">
                <Button variant={wordpressSettings.hasSettings ? "outline" : "default"} className="w-full">
                  <Settings size={16} className="mr-2" />
                  {wordpressSettings.hasSettings ? '設定を編集' : '設定を開始'}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 初回セットアップガイド */}
      {!isSetupComplete && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>初回セットアップガイド</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-600">
                初めてご利用の場合は、以下の順序で設定を進めることをお勧めします
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li className={sanitySettings.hasSettings ? 'line-through text-gray-400' : ''}>
                  <strong>Sanity CMS設定</strong> - コンテンツ管理システムの設定
                </li>
                <li className={wordpressSettings.hasSettings ? 'line-through text-gray-400' : ''}>
                  <strong>WordPress設定</strong> - 公開先サイトの設定
                </li>
                <li className={isSetupComplete ? 'text-green-600 font-medium' : 'text-gray-400'}>
                  <strong>ランディングページ作成</strong> - AIによる自動生成とWordPress公開
                </li>
              </ol>
              
              {!sanitySettings.hasSettings && (
                <div className="pt-4">
                  <Link href="/setup/sanity">
                    <Button>
                      Sanity設定から開始する
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}