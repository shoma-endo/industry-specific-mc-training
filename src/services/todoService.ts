import { TodoRepository } from '@/repositories/todoRepository';
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
   */
  async getAllTodos(): Promise<TodoItem[]> {
    return this.repository.findAll();
  }

  /**
   * 新しいTodoを追加
   * @param text Todoのテキスト
   */
  async createTodo(text: string): Promise<TodoItem> {
    // テキストの検証やフォーマットなどのビジネスロジックをここに実装
    const trimmedText = text.trim();
    
    if (!trimmedText) {
      throw new Error('Todo text cannot be empty');
    }
    
    return this.repository.create(trimmedText);
  }

  /**
   * Todoの完了状態を切り替え
   * @param id TodoのID
   */
  async toggleTodoStatus(id: number): Promise<void> {
    // 必要なビジネスロジックをここに実装
    return this.repository.toggleComplete(id);
  }

  /**
   * Todoを削除
   * @param id TodoのID
   */
  async removeTodo(id: number): Promise<void> {
    return this.repository.delete(id);
  }

  /**
   * すべてのTodoを削除
   */
  async clearAllTodos(): Promise<void> {
    return this.repository.deleteAll();
  }
} 