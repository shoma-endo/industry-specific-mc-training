'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSanityProject } from '@/server/handler/actions/sanity.action';
import { useLiffContext } from '@/components/LiffProvider';

export default function SanityProjectForm() {
  const [projectId, setProjectId] = useState('');
  const [dataset, setDataset] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { getAccessToken } = useLiffContext();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const liffAccessToken = await getAccessToken();

      if (!liffAccessToken) {
        console.error('[SanityForm] Failed to get LIFF Access Token or token is empty.');
        setError('LIFF認証トークンの取得に失敗しました。');
        setLoading(false);
        return;
      }

      // サーバーアクション経由でSanityプロジェクトを登録
      await createSanityProject(liffAccessToken, projectId, dataset);

      setLoading(false);
      router.push('/studio');
    } catch (error: unknown) {
      console.error('[SanityForm] Error in handleSubmit:', error);
      const message = error instanceof Error ? error.message : 'Sanityの登録に失敗しました';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md p-6 rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center mb-4">
            Sanityプロジェクト設定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="projectId" className="block text-sm font-medium">
                Project ID
              </label>
              <Input
                id="projectId"
                type="text"
                placeholder="例: abc123xy"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
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
                value={dataset}
                onChange={e => setDataset(e.target.value)}
                required
                className="w-full"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                {loading ? '登録中...' : '保存して進む'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
