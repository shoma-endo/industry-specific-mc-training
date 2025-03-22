import { TodoItem } from '@/types/todo';

// メモリ内データストア（実際の開発ではデータベースを使用）
let todos: TodoItem[] = [];

/**
 * TodoRepositoryクラス: データアクセスの責務を持つ
 * データベースアクセスのロジックをカプセル化する
 */
export class TodoRepository {
  /**
   * すべてのTodoアイテムを取得
   */
  async findAll(): Promise<TodoItem[]> {
    console.log('findAll', todos);
    // 実際の実装ではデータベースからのクエリになる
    return todos;
  }

  /**
   * 新しいTodoアイテムを作成
   */
  async create(text: string): Promise<TodoItem> {
    const newTodo: TodoItem = {
      id: Date.now(),
      text,
      completed: false
    };
    
    todos = [...todos, newTodo];
    return newTodo;
  }

  /**
   * Todoアイテムの完了状態を切り替える
   */
  async toggleComplete(id: number): Promise<void> {
    todos = todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
  }

  /**
   * 特定のTodoアイテムを削除
   */
  async delete(id: number): Promise<void> {
    todos = todos.filter(todo => todo.id !== id);
  }

  /**
   * すべてのTodoアイテムを削除
   */
  async deleteAll(): Promise<void> {
    todos = [];
  }
} 