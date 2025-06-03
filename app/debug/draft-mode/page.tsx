import { draftMode } from 'next/headers';
import Link from 'next/link';

export default async function DraftModeDebugPage() {
  const { isEnabled: isDraftMode } = await draftMode();

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Draft Mode デバッグツール</h1>

      <div className="bg-gray-100 p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">現在の状態</h2>
        <div className="flex items-center gap-4">
          <span className="text-lg">Draft Mode:</span>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isDraftMode ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {isDraftMode ? '有効' : '無効'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">操作</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href={`/api/draft/enable?token=${process.env.SANITY_WEBHOOK_SECRET}&redirect=${encodeURIComponent('/debug/draft-mode')}`}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-center"
          >
            Draft Mode を有効にする
          </Link>

          <Link
            href="/api/draft/disable"
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-center"
          >
            Draft Mode を無効にする
          </Link>
        </div>
      </div>

      <div className="mt-8 p-4 border-l-4 border-blue-500 bg-blue-50">
        <h3 className="font-semibold text-blue-800 mb-2">使い方</h3>
        <ul className="text-blue-700 space-y-1 text-sm">
          <li>• Draft Mode が有効な場合、Sanity の drafts.* ドキュメントが表示されます</li>
          <li>• Sanity Studio のプレビューは自動的に Draft Mode を有効にします</li>
          <li>• 本番環境では適切な認証トークンが必要です</li>
        </ul>
      </div>
    </div>
  );
}
