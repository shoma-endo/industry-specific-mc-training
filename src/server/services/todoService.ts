import { TodoRepository } from '@/server/repositories/todoRepository';
import { TodoItem } from '@/types/todo';

/**
 * TodoServiceクラス: ビジネスロジックの責務を持つ
 * アプリケーションのビジネスルールを実装
 */
export class TodoService {
  private repository: TodoRepository;

  constructor() {
    this.repository = new TodoRepository();
  }

  /**
   * すべてのTodoを取得
   * @param userId 特定ユーザーのTodoのみ取得する場合のユーザーID
   */
  async getAllTodos(userId?: string): Promise<TodoItem[]> {
    return this.repository.findAll(userId);
  }

  /**
   * 新しいTodoを追加
   * @param text Todoのテキスト
   * @param userId Todoの所有者となるユーザーID
   */
  async createTodo(text: string, userId?: string): Promise<TodoItem> {
    // テキストの検証やフォーマットなどのビジネスロジックをここに実装
    const trimmedText = text.trim();
    
    if (!trimmedText) {
      throw new Error('Todo text cannot be empty');
    }
    
    return this.repository.create(trimmedText, userId);
  }

  /**
   * Todoの完了状態を切り替え
   * @param id TodoのID
   * @param userId 操作を行うユーザーのID
   */
  async toggleTodoStatus(id: number, userId?: string): Promise<void> {
    // 必要なビジネスロジックをここに実装
    return this.repository.toggleComplete(id, userId);
  }

  /**
   * Todoを削除
   * @param id TodoのID
   * @param userId 操作を行うユーザーのID
   */
  async removeTodo(id: number, userId?: string): Promise<void> {
    return this.repository.delete(id, userId);
  }

  /**
   * すべてのTodoを削除
   * @param userId 特定ユーザーのTodoのみ削除する場合のユーザーID
   */
  async clearAllTodos(userId?: string): Promise<void> {
    return this.repository.deleteAll(userId);
  }
} 