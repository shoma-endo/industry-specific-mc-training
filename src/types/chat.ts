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

/**
 * チャットメッセージのデータベースモデル
 */
export interface DbChatMessage {
  id: string;
  user_id: string;
  session_id: string;
  role: string;
  content: string;
  model?: string | undefined;
  created_at: number;
}

/**
 * チャットセッションのデータベースモデル
 */
export interface DbChatSession {
  id: string;
  user_id: string;
  title: string;
  system_prompt?: string | undefined;
  last_message_at: number;
  created_at: number;
}

/**
 * アプリケーションモデルとデータベースモデル間の変換関数
 */
export function toDbChatMessage(message: ChatMessage): DbChatMessage {
  return {
    id: message.id,
    user_id: message.userId,
    session_id: message.sessionId,
    role: message.role,
    content: message.content,
    model: message.model,
    created_at: message.createdAt,
  };
}

export function toChatMessage(dbMessage: DbChatMessage): ChatMessage {
  return {
    id: dbMessage.id,
    userId: dbMessage.user_id,
    sessionId: dbMessage.session_id,
    role: dbMessage.role as ChatRole,
    content: dbMessage.content,
    model: dbMessage.model,
    createdAt: dbMessage.created_at,
  };
}

export function toDbChatSession(session: ChatSession): DbChatSession {
  return {
    id: session.id,
    user_id: session.userId,
    title: session.title,
    system_prompt: session.systemPrompt,
    last_message_at: session.lastMessageAt,
    created_at: session.createdAt,
  };
}

export function toChatSession(dbSession: DbChatSession): ChatSession {
  return {
    id: dbSession.id,
    userId: dbSession.user_id,
    title: dbSession.title,
    systemPrompt: dbSession.system_prompt,
    lastMessageAt: dbSession.last_message_at,
    createdAt: dbSession.created_at,
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

/**
 * Google検索結果のデータベースモデル
 */
export interface DbSearchResult {
  id: string;
  user_id: string;
  session_id: string;
  rank: number;
  title: string;
  snippet: string;
  link: string;
  created_at: number;
}

