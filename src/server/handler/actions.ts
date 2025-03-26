'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { TodoService } from '@/server/services/todoService';
import { TodoItem } from '@/types/todo';

// サービスのインスタンスを作成
const todoService = new TodoService();

// ユーザーIDの取得（本来はLIFFからのIDトークン検証が必要ですが、簡略化しています）
const getUserId = async () => {
  const cookieStore = await cookies();
  return cookieStore.get('userId')?.value;
};

/**
 * すべてのTodoを取得するサーバーアクション
 */
export async function getTodos(): Promise<TodoItem[]> {
  const userId = await getUserId();
  return todoService.getAllTodos(userId);
}

/**
 * 新しいTodoを追加するサーバーアクション
 */
export async function addTodo(text: string): Promise<TodoItem> {
  try {
    const userId = await getUserId();
    const newTodo = await todoService.createTodo(text, userId);
    revalidatePath('/');
    return newTodo;
  } catch (error) {
    console.error('Todo creation failed:', error);
    throw error;
  }
}

/**
 * Todoの完了状態を切り替えるサーバーアクション
 */
export async function toggleTodo(id: number): Promise<void> {
  const userId = await getUserId();
  await todoService.toggleTodoStatus(id, userId);
  revalidatePath('/');
}

/**
 * Todoを削除するサーバーアクション
 */
export async function deleteTodo(id: number): Promise<void> {
  const userId = await getUserId();
  await todoService.removeTodo(id, userId);
  revalidatePath('/');
}

/**
 * すべてのTodoを削除するサーバーアクション
 */
export async function deleteAllTodos(): Promise<void> {
  const userId = await getUserId();
  await todoService.clearAllTodos(userId);
  revalidatePath('/');
}

/**
 * ユーザーIDをクッキーに保存するサーバーアクション
 */
export async function setUserId(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('userId', userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1週間
    path: '/',
  });
  revalidatePath('/');
} 