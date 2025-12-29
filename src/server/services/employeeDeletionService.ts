import { SupabaseService } from './supabaseService';

// サービス本体（RPC一本化）
export class EmployeeDeletionService {
  private supabaseService: SupabaseService;

  constructor(supabaseService?: SupabaseService) {
    this.supabaseService = supabaseService ?? new SupabaseService();
  }

  /**
   * スタッフを削除し、オーナーの状態を更新する
   * 注意: Supabaseの制約により完全なトランザクション処理は困難なため、
   * エラーハンドリングとログ記録により部分的な失敗を検知可能にする
   */
  async deleteEmployee(employeeId: string, ownerId: string): Promise<void> {
    // RPCでスタッフ削除とオーナー復帰を原子的に実行
    const result = await this.supabaseService.deleteEmployeeAndRestoreOwner(
      employeeId,
      ownerId
    );
    if (!result.success) {
      console.error('[EmployeeDeletionService] スタッフ削除とオーナー復帰に失敗:', {
        employeeId,
        ownerId,
        error: result.error,
      });
      throw new Error(result.error.userMessage || 'スタッフの削除に失敗しました');
    }
  }
}
