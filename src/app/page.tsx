export default async function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">LINEアプリケーション</h1>
      <div className="p-8 max-w-md w-full bg-white rounded-lg shadow-md">
        <p className="text-center text-gray-700 mb-4">
          LINE Front-end Frameworkを使用したアプリケーションです。
        </p>
        <p className="text-center text-gray-700">ログインしてサービスをご利用ください。</p>
      </div>
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>LIFF SDKを使用したアプリケーション</p>
      </footer>
    </div>
  );
}
