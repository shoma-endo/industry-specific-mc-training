'use server';

import { revalidatePath } from 'next/cache';
import { TodoService } from '@/services/todoService';
import { TodoItem } from '@/types/todo';

// サービスのインスタンスを作成
const todoService = new TodoService();

/**
 * すべてのTodoを取得するサーバーアクション
 */
export async function getTodos(): Promise<TodoItem[]> {
  return todoService.getAllTodos();
}

/**
 * 新しいTodoを追加するサーバーアクション
 */
export async function addTodo(text: string): Promise<TodoItem> {
  try {
    const newTodo = await todoService.createTodo(text);
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
  await todoService.toggleTodoStatus(id);
  revalidatePath('/');
}

/**
 * Todoを削除するサーバーアクション
 */
export async function deleteTodo(id: number): Promise<void> {
  await todoService.removeTodo(id);
  revalidatePath('/');
}

/**
 * すべてのTodoを削除するサーバーアクション
 */
export async function deleteAllTodos(): Promise<void> {
  await todoService.clearAllTodos();
  revalidatePath('/');
} 