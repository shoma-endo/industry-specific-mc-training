import { createClient } from '@supabase/supabase-js';
import { TodoItem } from '@/types/todo';
import { env } from '@/env';

// 環境変数からSupabase URLとAnon Keyを取得
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Supabaseクライアントの初期化
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// スネークケース→キャメルケース変換のヘルパー関数
export function snakeToCamel<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // スネークケースをキャメルケースに変換
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  
  return result;
}

// キャメルケース→スネークケース変換のヘルパー関数
export function camelToSnake<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // キャメルケースをスネークケースに変換
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = value;
  }
  
  return result;
}

// TodoItemの型変換ヘルパー
export function toTodoItem(data: Record<string, unknown>): TodoItem {
  return {
    id: data.id as number,
    text: data.text as string,
    completed: data.completed as boolean,
    userId: data.user_id as string,
    createdAt: data.created_at as number
  };
}

// データベース用のTodoItem変換
export function toDbTodo(todo: Partial<TodoItem>): Record<string, unknown> {
  const { userId, createdAt, ...rest } = todo;
  return {
    ...rest,
    user_id: userId,
    created_at: createdAt
  };
} 