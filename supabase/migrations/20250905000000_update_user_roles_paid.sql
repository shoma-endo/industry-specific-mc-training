-- Introduce paid role and rename legacy user role to trial
-- Rollback plan:
-- 1. Drop the updated users_role_check constraint.
-- 2. UPDATE users SET role = 'user' WHERE role = 'trial';
-- 3. ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
-- 4. Recreate users_role_check with CHECK (role IN ('user', 'admin', 'unavailable')) and adjust comments as needed.

-- Ensure the previous constraint is removed before applying new values/defaults
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'users_role_check'
          AND table_name = 'users'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;
END $$;

-- Set the new default role for freshly created users
ALTER TABLE users
ALTER COLUMN role SET DEFAULT 'trial';

-- Rename existing general users to trial users
UPDATE users
SET role = 'trial',
    updated_at = EXTRACT(EPOCH FROM NOW()) * 1000
WHERE role = 'user';

-- Apply the updated constraint including the paid role
ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('trial', 'paid', 'admin', 'unavailable'));

-- Update documentation comment
COMMENT ON COLUMN users.role IS
  'User role: trial (default), paid subscribers, admin for elevated permissions, or unavailable for service suspension';
