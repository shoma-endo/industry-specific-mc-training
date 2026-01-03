import type { Database } from '@/types/database.types';

/**
 * チャットメッセージの型定義
 */
export interface ChatMessage {
  id: string; // メッセージID (自動生成)
  userId: string; // メッセージの送信者ID (ユーザーID)
  sessionId: string; // チャットセッションID
  role: ChatRole; // メッセージの役割 ('user'/'assistant'/'system')
  content: string; // メッセージの内容
  model?: string | undefined; // 使用されたAIモデル (assistantの場合)
  createdAt: number; // 作成日時 (タイムスタンプ)
}

/**
 * チャットセッションの型定義
 */
export interface ChatSession {
  id: string; // セッションID
  userId: string; // セッションの所有者ID
  title: string; // セッションのタイトル
  systemPrompt?: string | undefined; // システムプロンプト
  lastMessageAt: number; // 最後のメッセージ日時
  createdAt: number; // 作成日時
}

export interface ChatResponse {
  message: string;
  error?: string | undefined;
  sessionId?: string | undefined;
  requiresSubscription?: boolean | undefined;
}

/**
 * チャットの役割
 */
export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

const parseTimestamp = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid timestamp string: "${value}"`);
    }
    return parsed;
  }
  throw new Error(`Null or undefined timestamp received: ${String(value)}`);
};

/**
 * チャットメッセージのデータベースモデル
 */
export type DbChatMessage = Database['public']['Tables']['chat_messages']['Row'];

/**
 * チャットセッションのデータベースモデル
 */
export type DbChatSession = Database['public']['Tables']['chat_sessions']['Row'];

/**
 * チャットセッション検索結果のデータベース行
 */
export interface DbChatSessionSearchRow {
  session_id: string;
  title: string;
  canonical_url?: string | null;
  wp_post_title?: string | null;
  last_message_at: number;
  similarity_score: number;
}

/**
 * 検索APIが返す集約済みのチャットセッション情報
 */
export interface ChatSessionSearchMatch {
  sessionId: string;
  title: string;
  canonicalUrl: string | null;
  wordpressTitle: string | null;
  lastMessageAt: number;
  similarityScore: number;
}

/**
 * アプリケーションモデルとデータベースモデル間の変換関数
 */
export function toChatMessage(dbMessage: DbChatMessage): ChatMessage {
  return {
    id: dbMessage.id,
    userId: dbMessage.user_id,
    sessionId: dbMessage.session_id,
    role: dbMessage.role as ChatRole,
    content: dbMessage.content,
    model: dbMessage.model,
    createdAt: parseTimestamp(dbMessage.created_at),
  };
}

export function toChatSession(dbSession: DbChatSession): ChatSession {
  return {
    id: dbSession.id,
    userId: dbSession.user_id,
    title: dbSession.title,
    systemPrompt: dbSession.system_prompt,
    lastMessageAt: parseTimestamp(dbSession.last_message_at),
    createdAt: parseTimestamp(dbSession.created_at),
  };
}

/**
 * OpenAI API用のメッセージ型
 */
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * OpenAI API応答型
 */
export interface OpenAIResponse {
  message: string;
  error?: string;
}

/**
 * Server Component用の簡潔なChatMessage型
 */
export interface ServerChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
}

/**
 * Server Component用のChatSession型（RPCでメッセージを含む）
 */
export interface ServerChatSession {
  id: string;
  title: string;
  last_message_at: number;
  messages?: ServerChatMessage[]; // RPC で埋め込む
}
