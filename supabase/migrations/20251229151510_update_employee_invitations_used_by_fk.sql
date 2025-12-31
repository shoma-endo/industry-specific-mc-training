-- employee_invitations.used_by_user_id の削除時挙動を更新
ALTER TABLE employee_invitations
  DROP CONSTRAINT IF EXISTS employee_invitations_used_by_user_id_fkey;

ALTER TABLE employee_invitations
  ADD CONSTRAINT employee_invitations_used_by_user_id_fkey
  FOREIGN KEY (used_by_user_id)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- ロールバック案:
-- ALTER TABLE employee_invitations
--   DROP CONSTRAINT IF EXISTS employee_invitations_used_by_user_id_fkey;
-- ALTER TABLE employee_invitations
--   ADD CONSTRAINT employee_invitations_used_by_user_id_fkey
--   FOREIGN KEY (used_by_user_id)
--   REFERENCES users(id);
