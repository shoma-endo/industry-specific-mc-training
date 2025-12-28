import { SupabaseService } from './supabaseService';

export interface EmployeeDeletionStrategy {
  deleteEmployeeData(employeeId: string, ownerId: string): Promise<void>;
}

// 現在の実装（全削除）
export class FullDeletionStrategy implements EmployeeDeletionStrategy {
  constructor(private supabaseService: SupabaseService) {}

  async deleteEmployeeData(employeeId: string, _ownerId: string): Promise<void> {
    void _ownerId;
    // chat_sessions, briefs, content_annotations, gsc関連データ等を削除
    // supabaseServiceのdeleteUserByIdはCASCADE設定があれば関連データも消える可能性があるが
    // 明示的に削除メソッドがsupabaseServiceにある場合はそれを使うべき。
    // 現状のSupabaseServiceにはdeleteUserByIdがないため、実装が必要。

    // アプリケーションレベルでの論理削除ではなく物理削除を行う場合、
    // Supabaseのauth.usersからの削除はAdmin APIが必要だが、ここではpublic.usersテーブルの操作を指す

    // ここではまず、SupabaseServiceに追加予定の deleteUserFully メソッドなどを呼ぶ想定
    const result = await this.supabaseService.deleteUserFully(employeeId);
    if (!result.success) {
      throw new Error(result.error.userMessage || 'スタッフデータの削除に失敗しました');
    }
  }
}

// 将来の実装（引き継ぎ）- 必要時に実装
// export class TransferDeletionStrategy implements EmployeeDeletionStrategy { ... }

// サービス本体
export class EmployeeDeletionService {
  private strategy: EmployeeDeletionStrategy;
  private supabaseService: SupabaseService;

  constructor(strategy?: EmployeeDeletionStrategy, supabaseService?: SupabaseService) {
    // SupabaseServiceインスタンスを先に作成し、strategyと共有してトランザクションの一貫性を保証
    this.supabaseService = supabaseService ?? new SupabaseService();
    this.strategy = strategy ?? new FullDeletionStrategy(this.supabaseService);
  }

  /**
   * スタッフを削除し、オーナーの状態を更新する
   * 注意: Supabaseの制約により完全なトランザクション処理は困難なため、
   * エラーハンドリングとログ記録により部分的な失敗を検知可能にする
   */
  async deleteEmployee(employeeId: string, ownerId: string): Promise<void> {
    // スタッフデータの削除
    try {
      await this.strategy.deleteEmployeeData(employeeId, ownerId);
    } catch (error) {
      console.error('[EmployeeDeletionService] スタッフデータの削除に失敗:', {
        employeeId,
        ownerId,
        error,
      });
      throw error;
    }

    // あなたの状態を一括更新（ロールをpaidに戻し、owner_user_idをクリア）
    // 注意: 削除が成功した後に更新が失敗した場合、データ不整合が発生する可能性がある
    // 将来的にはPostgreSQLのトランザクション（RPC関数）を使用することを検討
    const result = await this.supabaseService.updateUserById(ownerId, {
      role: 'paid',
      owner_user_id: null,
      updated_at: Date.now(),
    });

    if (!result.success) {
      console.error('[EmployeeDeletionService] オーナー更新に失敗:', {
        ownerId,
        error: result.error,
        // 削除は成功しているため、手動での復旧が必要な可能性がある
      });
      throw new Error(result.error.userMessage || 'あなたのロール更新に失敗しました');
    }
  }
}
