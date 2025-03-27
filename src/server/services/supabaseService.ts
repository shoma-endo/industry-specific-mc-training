import { createClient } from '@supabase/supabase-js';
import { env } from '@/env';

/**
 * SupabaseServiceクラス: サーバーサイドでSupabaseを操作するためのサービス
 * SERVICE_ROLEを使用して特権操作を提供
 */
export class SupabaseService {
  private supabaseAdmin;

  constructor() {
    // 環境変数からSupabase URLとサービスロールキーを取得
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRole = env.SUPABASE_SERVICE_ROLE;

    // 管理者権限を持つSupabaseクライアントの初期化
    this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
}
