import { TodoItem } from '@/types/todo';
import { supabase, toTodoItem, toDbTodo } from '@/lib/supabase';

/**
 * TodoRepositoryクラス: データアクセスの責務を持つ
 * Supabaseを使用してデータベースアクセスのロジックをカプセル化する
 */
export class TodoRepository {
  /**
   * すべてのTodoアイテムを取得
   * @param userId 特定ユーザーのTodoのみ取得する場合のユーザーID
   */
  async findAll(userId?: string): Promise<TodoItem[]> {
    let query = supabase.from('todos').select('*');
    
    // ユーザーIDが指定されている場合、そのユーザーのTodoのみ取得
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Todoの取得に失敗しました:', error);
      throw error;
    }
    
    // データベースの結果をアプリケーションの型に変換
    return (data || []).map(item => toTodoItem(item));
  }

  /**
   * 新しいTodoアイテムを作成
   */
  async create(text: string, userId?: string): Promise<TodoItem> {
    const newTodo = {
      text,
      completed: false,
      userId: userId || "",
      createdAt: Date.now()
      
    };
    
    // アプリケーションの型からデータベースの型に変換
    const dbTodo = toDbTodo(newTodo);
    
    const { data, error } = await supabase
      .from('todos')
      .insert([dbTodo])
      .select()
      .single();
    
    if (error) {
      console.error('Todoの作成に失敗しました:', error);
      throw error;
    }
    
    return toTodoItem(data);
  }

  /**
   * Todoアイテムの完了状態を切り替える
   * @param id TodoのID
   * @param userId 操作を行うユーザーのID（認可チェック用）
   */
  async toggleComplete(id: number, userId?: string): Promise<void> {
    // まず現在のTodoを取得
    const { data: todo, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('Todoの取得に失敗しました:', fetchError);
      throw fetchError;
    }
    
    // ユーザーIDによる認可チェック
    if (userId && todo.user_id && todo.user_id !== userId) {
      throw new Error('この操作を行う権限がありません');
    }
    
    // Todoの完了状態を切り替え
    const { error } = await supabase
      .from('todos')
      .update({ completed: !todo.completed })
      .eq('id', id);
    
    if (error) {
      console.error('Todoの更新に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 特定のTodoアイテムを削除
   * @param id TodoのID
   * @param userId 操作を行うユーザーのID（認可チェック用）
   */
  async delete(id: number, userId?: string): Promise<void> {
    let query = supabase.from('todos').delete().eq('id', id);
    
    // ユーザーIDが指定されている場合、そのユーザーのTodoのみ削除可能
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { error } = await query;
    
    if (error) {
      console.error('Todoの削除に失敗しました:', error);
      throw error;
    }
  }

  /**
   * すべてのTodoアイテムを削除
   * @param userId 特定ユーザーのTodoのみ削除する場合のユーザーID
   */
  async deleteAll(userId?: string): Promise<void> {
    let query = supabase.from('todos').delete();
    
    // ユーザーIDが指定されている場合、そのユーザーのTodoのみ削除
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      // すべてのTodoを削除する場合は、確認が必要
      query = query.neq('id', 0); // 常にtrueとなる条件（全レコード削除）
    }
    
    const { error } = await query;
    
    if (error) {
      console.error('Todoの一括削除に失敗しました:', error);
      throw error;
    }
  }
} 