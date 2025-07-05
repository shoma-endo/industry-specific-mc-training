-- Add role column to users table
-- This migration adds role-based access control with 'user' and 'admin' roles

-- Add the role column with enum constraint
ALTER TABLE users 
ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
CHECK (role IN ('user', 'admin'));

-- Update the updated_at timestamp 
UPDATE users SET updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;

-- Create index for efficient role-based queries
CREATE INDEX idx_users_role ON users(role);

-- Add comment for documentation
COMMENT ON COLUMN users.role IS 'User role: user (default) or admin for elevated permissions';