import { Card } from '@/components/ui/card';
import { Bot } from 'lucide-react';

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* サイドバースケルトン */}
      <div className="bg-slate-50 border-r flex-shrink-0 flex flex-col w-80 relative h-full">
        <div className="p-4 border-b">
          <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4"></div>
            </div>
          ))}
        </div>
      </div>

      {/* メインエリアスケルトン */}
      <div className="flex-1 flex flex-col">
        {/* ヘッダー */}
        <div className="h-16 border-b bg-white flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <Bot className="h-6 w-6 text-[#06c755]" />
            <div className="h-5 bg-gray-200 rounded animate-pulse w-32"></div>
          </div>
          <div className="h-9 bg-gray-200 rounded animate-pulse w-40"></div>
        </div>

        {/* メッセージエリア */}
        <div className="flex-1 flex items-center justify-center bg-slate-100">
          <Card className="p-6 text-center max-w-sm w-full shadow-sm">
            <div className="w-12 h-12 bg-[#06c755] rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot size={24} className="text-white" />
            </div>
            <h3 className="text-lg font-medium mb-3">チャットを読み込み中</h3>
            <div className="flex gap-2 items-center justify-center">
              <div
                className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              ></div>
              <div
                className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
                style={{ animationDelay: '200ms' }}
              ></div>
              <div
                className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce"
                style={{ animationDelay: '400ms' }}
              ></div>
            </div>
          </Card>
        </div>

        {/* 入力エリアスケルトン */}
        <div className="border-t p-3 bg-white">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-2">
            <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}