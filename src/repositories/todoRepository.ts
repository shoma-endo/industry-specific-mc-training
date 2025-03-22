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
   * @param userId 特定ユーザーのTodoのみ取得する場合のユーザーID
   */
  async findAll(userId?: string): Promise<TodoItem[]> {
    // ユーザーIDが指定されている場合、そのユーザーのTodoのみ返す
    if (userId) {
      return todos.filter(todo => todo.userId === userId || !todo.userId);
    }
    // 実際の実装ではデータベースからのクエリになる
    return todos;
  }

  /**
   * 新しいTodoアイテムを作成
   */
  async create(text: string, userId?: string): Promise<TodoItem> {
    const newTodo: TodoItem = {
      id: Date.now(),
      text,
      completed: false,
      userId,
      createdAt: Date.now()
    };
    
    todos = [...todos, newTodo];
    return newTodo;
  }

  /**
   * Todoアイテムの完了状態を切り替える
   * @param id TodoのID
   * @param userId 操作を行うユーザーのID（認可チェック用）
   */
  async toggleComplete(id: number, userId?: string): Promise<void> {
    todos = todos.map(todo => {
      // 所有者チェック: ユーザーIDが設定されている場合は、そのユーザーのTodoのみ操作可能
      if (todo.id === id && (!todo.userId || !userId || todo.userId === userId)) {
        return { ...todo, completed: !todo.completed };
      }
      return todo;
    });
  }

  /**
   * 特定のTodoアイテムを削除
   * @param id TodoのID
   * @param userId 操作を行うユーザーのID（認可チェック用）
   */
  async delete(id: number, userId?: string): Promise<void> {
    // 所有者チェック: ユーザーIDが設定されている場合は、そのユーザーのTodoのみ削除可能
    todos = todos.filter(todo => 
      todo.id !== id || (todo.userId && userId && todo.userId !== userId)
    );
  }

  /**
   * すべてのTodoアイテムを削除
   * @param userId 特定ユーザーのTodoのみ削除する場合のユーザーID
   */
  async deleteAll(userId?: string): Promise<void> {
    if (userId) {
      // 特定ユーザーのTodoのみ削除
      todos = todos.filter(todo => todo.userId !== userId);
    } else {
      // すべてのTodoを削除
      todos = [];
    }
  }
} 