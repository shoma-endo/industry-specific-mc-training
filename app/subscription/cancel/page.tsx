import Link from "next/link";

export default function SubscriptionCancelPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-lg mx-auto bg-white p-8 rounded-lg shadow-md text-center">
        <div className="text-yellow-500 text-6xl mb-4">!</div>
        <h1 className="text-2xl font-bold mb-4">決済がキャンセルされました</h1>
        <p className="text-gray-600 mb-6">
          サブスクリプションの登録がキャンセルされました。
          問題が発生した場合は、サポートにお問い合わせください。
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/subscription"
            className="inline-block bg-blue-500 text-white py-2 px-6 rounded hover:bg-blue-600 transition-colors"
          >
            登録ページに戻る
          </Link>
          <Link
            href="/"
            className="inline-block bg-gray-200 text-gray-800 py-2 px-6 rounded hover:bg-gray-300 transition-colors"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  );
} 