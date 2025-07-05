-- Add INSERT permissions for users table
-- This migration grants INSERT permissions to anon and authenticated roles for user creation

-- Grant INSERT permissions on users table
GRANT INSERT ON users TO anon;
GRANT INSERT ON users TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE users IS 'Users table with full CRUD permissions for anon and authenticated roles for seamless user registration'; 