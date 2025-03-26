'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { TodoService } from '@/server/services/todoService';
import { TodoItem } from '@/types/todo';

// サービスのインスタンスを作成
const todoService = new TodoService();

// ユーザーIDの取得（本来はLIFFからのIDトークン検証が必要ですが、簡略化しています）

/**
 * すべてのTodoを取得するサーバーアクション
 */
export async function getTodos(): Promise<TodoItem[]> {
  // const userId = await getUserId();
  // return todoService.getAllTodos(userId);
  return [
    {
      id: 1,
      text: "test",
      completed: false,
      createdAt: 1, 
      userId: "1234567890",
    }
  ]
}

/**
 * 新しいTodoを追加するサーバーアクション
 */
export async function addTodo(text: string): Promise<TodoItem> {
  // try {
  //   const userId = await getUserId();
  //   const newTodo = await todoService.createTodo(text, userId);
  //   revalidatePath('/');
  //   return newTodo;
  // } catch (error) {
  //   console.error('Todo creation failed:', error);
  //   throw error;
  // }
  return {
    id: 1,
    text: text,
    completed: false,
    createdAt: 1,
    userId: "1234567890",
  }
}

/**
 * Todoの完了状態を切り替えるサーバーアクション
 */
export async function toggleTodo(id: number): Promise<void> {
  // const userId = await getUserId();
  // await todoService.toggleTodoStatus(id, userId);
  // revalidatePath('/');
}

/**
 * Todoを削除するサーバーアクション
 */
export async function deleteTodo(id: number): Promise<void> {
  // const userId = await getUserId();
  // await todoService.removeTodo(id, userId);
  // revalidatePath('/');
}

/**
 * すべてのTodoを削除するサーバーアクション
 */
export async function deleteAllTodos(): Promise<void> {
  // const userId = await getUserId();
  // await todoService.clearAllTodos(userId);
  // revalidatePath('/');
}