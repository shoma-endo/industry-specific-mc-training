-- 既存カラムに追加
ALTER TABLE users ADD COLUMN owner_user_id UUID REFERENCES users(id);

-- roleの制約を更新（ownerを追加）
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('trial', 'paid', 'admin', 'unavailable', 'owner'));

-- インデックス追加
CREATE INDEX idx_users_owner_user_id ON users(owner_user_id);

-- employee_invitationsテーブル（新規）
CREATE TABLE employee_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitation_token TEXT NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  used_at BIGINT,
  used_by_user_id UUID REFERENCES users(id),
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

COMMENT ON TABLE employee_invitations IS 'スタッフ招待リンクの発行・検証用の一時テーブル';
COMMENT ON COLUMN employee_invitations.owner_user_id IS '招待元ユーザー（あなた）ID';
COMMENT ON COLUMN employee_invitations.invitation_token IS '招待URLに埋め込むトークン';
COMMENT ON COLUMN employee_invitations.expires_at IS '招待の有効期限（UNIXミリ秒）';
COMMENT ON COLUMN employee_invitations.used_at IS '招待使用時刻（UNIXミリ秒）';
COMMENT ON COLUMN employee_invitations.used_by_user_id IS '招待を使用したスタッフユーザーID';
COMMENT ON COLUMN employee_invitations.created_at IS '招待作成時刻（UNIXミリ秒）';

-- インデックス
CREATE INDEX idx_employee_invitations_owner ON employee_invitations(owner_user_id);

-- RLSポリシー（開発環境用）
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;
-- 本番環境用RLSポリシー
CREATE POLICY "owners_manage_own_invitations" ON employee_invitations
  FOR ALL
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- 30日TTL（使用済み/期限切れを定期削除）
-- ロールバック案:
-- SELECT cron.unschedule('cleanup-employee-invitations-ttl');
-- DROP FUNCTION IF EXISTS public.accept_employee_invitation(uuid, text);
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'cleanup-employee-invitations-ttl',
  '0 0 * * *',
  $$
  DELETE FROM employee_invitations
  WHERE (
    used_at IS NOT NULL
    AND used_at < (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - (30 * 24 * 60 * 60 * 1000)
  )
  OR (
    used_at IS NULL
    AND expires_at < (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - (30 * 24 * 60 * 60 * 1000)
  );
  $$
);
