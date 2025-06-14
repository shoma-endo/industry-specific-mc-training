'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createSanityProject, createSelfHostedWordPressSettings } from '@/server/handler/actions/sanity.action';
import { WordPressType } from '@/types/wordpress';

interface Props {
  liffAccessToken: string;
}

export default function SanityProjectForm({ liffAccessToken }: Props) {
  const [wpType, setWpType] = useState<WordPressType>('wordpress_com');
  // WordPress.com用
  const [wpClientId, setWpClientId] = useState('');
  const [wpClientSecret, setWpClientSecret] = useState('');
  const [wpSiteId, setWpSiteId] = useState('');
  // セルフホスト用
  const [wpSiteUrl, setWpSiteUrl] = useState('');
  const [wpUsername, setWpUsername] = useState('');
  const [wpApplicationPassword, setWpApplicationPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!liffAccessToken) {
        console.error('[SanityForm] Failed to get LIFF Access Token or token is empty.');
        setError('LIFF認証トークンの取得に失敗しました。');
        setLoading(false);
        return;
      }

      if (wpType === 'wordpress_com') {
        // WordPress.com設定を保存
        await createSanityProject(
          liffAccessToken,
          '', // projectId
          '', // dataset
          wpClientId,
          wpClientSecret,
          wpSiteId
        );
        alert('WordPress.com設定を保存しました。');
      } else {
        // セルフホストWordPress設定を保存
        await createSelfHostedWordPressSettings(
          liffAccessToken,
          wpSiteUrl,
          wpUsername,
          wpApplicationPassword
        );
        alert('セルフホストWordPress設定を保存しました。');
      }

      setLoading(false);
      // ランディングページ作成画面に遷移
      router.push('/ad-form');
    } catch (error: unknown) {
      console.error('[SanityForm] Error in handleSubmit:', error);
      const message = error instanceof Error ? error.message : 'WordPress設定の保存に失敗しました';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center bg-gray-50 px-4 py-12 min-h-screen">
      <Card className="w-full max-w-5xl p-6 rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center mb-4">WordPress連携設定</CardTitle>
          <p className="text-center text-gray-600">
            ランディングページを作成・管理するために、WordPressとの連携設定が必要です
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* WordPress種別選択 */}
            <div className="space-y-4">
              <fieldset className="border p-4 rounded-md">
                <legend className="text-lg font-medium px-1">WordPress種別選択</legend>
                <div className="space-y-3 mt-2">
                  <label className="block text-sm font-medium">使用するWordPressの種類</label>
                  <Select 
                    value={wpType} 
                    onValueChange={(value: WordPressType) => setWpType(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="WordPress種別を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wordpress_com">WordPress.com (Web版)</SelectItem>
                      <SelectItem value="self_hosted">セルフホスト版WordPress</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {wpType === 'wordpress_com' 
                      ? 'WordPress.comでホストされているサイト用の設定です。OAuth認証を使用します。'
                      : 'ご自身のサーバーで運営しているWordPressサイト用の設定です。Application Passwordを使用します。'
                    }
                  </p>
                </div>
              </fieldset>
            </div>

            <div className="flex flex-col md:flex-row md:space-x-6">
              {/*
              <fieldset className="border p-4 rounded-md w-full md:w-1/2 mb-6 md:mb-0">
                <legend className="text-lg font-medium px-1">Sanity プロジェクト</legend>

                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                  <p className="font-semibold mb-1">Sanity Project ID と Dataset の確認方法</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <strong>Sanity Manage (推奨):</strong>
                      <ol className="list-decimal list-inside ml-4 mt-1 space-y-0.5">
                        <li>
                          <a
                            href="https://manage.sanity.io/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline hover:text-green-600"
                          >
                            manage.sanity.io
                          </a>{' '}
                          にアクセスし、ログインします。
                        </li>
                        <li>該当するプロジェクトを選択します。</li>
                        <li>
                          プロジェクトのダッシュボードや設定ページで <strong>Project ID</strong>{' '}
                          を確認できます。
                        </li>
                        <li>
                          プロジェクト設定内の <strong>API</strong>{' '}
                          セクション（または同様の名称のセクション）で <strong>Dataset</strong>{' '}
                          の名前を確認できます。通常{' '}
                          <code className="text-xs bg-gray-100 p-0.5 rounded">
                            &quot;production&quot;
                          </code>
                          ,{' '}
                          <code className="text-xs bg-gray-100 p-0.5 rounded">
                            &quot;development&quot;
                          </code>{' '}
                          などが使われます。
                        </li>
                      </ol>
                    </li>
                  </ul>
                </div>

                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <label htmlFor="projectId" className="block text-sm font-medium">
                      Project ID
                    </label>
                    <Input
                      id="projectId"
                      type="text"
                      placeholder="例: abc123xy"
                      value={''}
                      onChange={() => {}}
                      required
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="dataset" className="block text-sm font-medium">
                      Dataset名
                    </label>
                    <Input
                      id="dataset"
                      type="text"
                      placeholder="例: production"
                      value={''}
                      onChange={() => {}}
                      required
                      className="w-full"
                    />
                  </div>
                </div>
              </fieldset>
              */}

              {wpType === 'wordpress_com' ? (
                <fieldset className="border p-4 rounded-md w-full">
                  <legend className="text-lg font-medium px-1">WordPress.com 設定</legend>

                  <div className="mb-4 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                    <p className="font-semibold mb-1">WordPress.com アプリケーションの準備</p>
                    <p>
                      WordPress.com Client ID と Client Secret を取得するには、WordPress.com
                      で新しいアプリケーションを登録する必要があります。 詳細は{' '}
                      <a
                        href="https://developer.wordpress.com/docs/oauth2/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline hover:text-blue-600"
                      >
                        WordPress.com OAuth2ドキュメント
                      </a>{' '}
                      を参照し、
                      <a
                        href="https://developer.wordpress.com/apps/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline hover:text-blue-600"
                      >
                        こちらからアプリケーションを作成
                      </a>
                      してください。
                    </p>
                    <p className="mt-2">
                      アプリケーション作成の際、
                      <strong className="font-semibold">
                        リダイレクトURI (コールバックURL)
                      </strong>{' '}
                      には、お使いの環境に合わせて以下の形式のURLを設定してください:
                      <code className="block bg-gray-100 p-1 border rounded text-xs mt-1">{`${typeof window !== 'undefined' ? window.location.origin : '[あなたのサイトのドメイン]'}/api/wordpress/oauth/callback`}</code>
                      <span className="text-xs block mt-1">
                        例: <code>https://example.com/api/wordpress/oauth/callback</code>
                      </span>
                    </p>
                  </div>

                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <label htmlFor="wpClientId" className="block text-sm font-medium">
                        WordPress.com Client ID
                      </label>
                      <Input
                        id="wpClientId"
                        type="text"
                        placeholder="WordPress.comアプリケーションのクライアントID"
                        value={wpClientId}
                        onChange={e => setWpClientId(e.target.value)}
                        className="w-full"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="wpClientSecret" className="block text-sm font-medium">
                        WordPress.com Client Secret
                      </label>
                      <Input
                        id="wpClientSecret"
                        type="password"
                        placeholder="WordPress.comアプリケーションのクライアントシークレット"
                        value={wpClientSecret}
                        onChange={e => setWpClientSecret(e.target.value)}
                        className="w-full"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="wpSiteId" className="block text-sm font-medium">
                        WordPress.com Site ID (またはドメイン)
                      </label>
                      <Input
                        id="wpSiteId"
                        type="text"
                        placeholder="例: 123456789 または yoursite.wordpress.com"
                        value={wpSiteId}
                        onChange={e => setWpSiteId(e.target.value)}
                        className="w-full"
                        required
                      />
                      <p className="text-xs text-gray-500 pt-1">
                        Site IDは{' '}
                        <a
                          href="https://developer.wordpress.com/docs/api/1.1/get/sites/%24site/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          WordPress.com APIドキュメント
                        </a>{' '}
                        を参照して確認してください。通常、サイトのアドレス (例:
                        `example.wordpress.com`) または数値のIDです。
                      </p>
                    </div>
                  </div>
                </fieldset>
              ) : (
                <fieldset className="border p-4 rounded-md w-full">
                  <legend className="text-lg font-medium px-1">セルフホストWordPress 設定</legend>

                  <div className="mb-4 mt-2 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                    <p className="font-semibold mb-1">Application Passwordの設定方法</p>
                    <ol className="list-decimal list-inside space-y-1 mt-2">
                      <li>WordPressの管理画面にログインします</li>
                      <li>「ユーザー」→「プロフィール」に移動します</li>
                      <li>「アプリケーションパスワード」セクションを見つけます</li>
                      <li>新しいアプリケーション名（例：「ランディングページ作成ツール」）を入力</li>
                      <li>「新しいアプリケーションパスワードを追加」をクリックします</li>
                      <li>生成されたパスワードをコピーして、下記の「Application Password」フィールドに貼り付けます</li>
                    </ol>
                    <p className="mt-2 text-xs">
                      ※ Application Passwordは WordPress 5.6 以降で利用可能です。古いバージョンをお使いの場合は、プラグインでの対応が必要です。
                    </p>
                  </div>

                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <label htmlFor="wpSiteUrl" className="block text-sm font-medium">
                        サイトURL
                      </label>
                      <Input
                        id="wpSiteUrl"
                        type="url"
                        placeholder="https://example.com"
                        value={wpSiteUrl}
                        onChange={e => setWpSiteUrl(e.target.value)}
                        className="w-full"
                        required
                      />
                      <p className="text-xs text-gray-500 pt-1">
                        WordPressサイトのURL（例: https://example.com）
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="wpUsername" className="block text-sm font-medium">
                        ユーザー名
                      </label>
                      <Input
                        id="wpUsername"
                        type="text"
                        placeholder="WordPressのユーザー名"
                        value={wpUsername}
                        onChange={e => setWpUsername(e.target.value)}
                        className="w-full"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="wpApplicationPassword" className="block text-sm font-medium">
                        Application Password
                      </label>
                      <Input
                        id="wpApplicationPassword"
                        type="password"
                        placeholder="WordPressで生成したApplication Password"
                        value={wpApplicationPassword}
                        onChange={e => setWpApplicationPassword(e.target.value)}
                        className="w-full"
                        required
                      />
                      <p className="text-xs text-gray-500 pt-1">
                        WordPressの管理画面で生成したApplication Passwordを入力してください
                      </p>
                    </div>
                  </div>
                </fieldset>
              )}
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 text-base"
                disabled={loading}
              >
                {loading ? '保存中...' : `${wpType === 'wordpress_com' ? 'WordPress.com' : 'セルフホストWordPress'}設定を保存してランディングページ作成に進む`}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
