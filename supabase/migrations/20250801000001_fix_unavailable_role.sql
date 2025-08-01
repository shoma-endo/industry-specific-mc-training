-- Fix role constraint to include 'unavailable' option
-- This ensures the unavailable role can be set in the users table

-- First, check if the constraint exists and drop it
DO $$ 
BEGIN
    -- Drop the constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_role_check' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;
END $$;

-- Add the new constraint that includes 'unavailable'
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('user', 'admin', 'unavailable'));

-- Update comment
COMMENT ON COLUMN users.role IS 'User role: user (default), admin for elevated permissions, or unavailable for service suspension';

-- Update timestamp for tracking
UPDATE users SET updated_at = EXTRACT(EPOCH FROM NOW()) * 1000 WHERE updated_at IS NOT NULL;