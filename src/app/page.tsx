import { TodoList } from '@/components/features/TodoList';
import { getTodos } from '../server/handler/actions/actions';

export default async function Home() {
  // サーバーコンポーネントでの初期データ取得
  // 結果はクライアントコンポーネントには直接渡しませんが、
  // サーバーサイドレンダリング時にデータを事前に準備しておきます
  // await getTodos();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">LINEToDoアプリ</h1>
      <TodoList />
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>LIFF SDKを使用したToDoアプリ</p>
      </footer>
    </div>
  );
}
