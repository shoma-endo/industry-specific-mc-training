import { ServerChatSession } from '@/types/chat';

interface ChatListProps {
  sessions: ServerChatSession[];
}

export default function ChatList({ sessions }: ChatListProps) {
  // Server Componentとしてセッション一覧を単純にレンダリング
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">チャット履歴</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">まだチャット履歴がありません</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {sessions.map(session => (
              <li key={session.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {session.title || '新しい会話'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(session.last_message_at).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {session.messages && session.messages.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {session.messages.length}件のメッセージ
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}