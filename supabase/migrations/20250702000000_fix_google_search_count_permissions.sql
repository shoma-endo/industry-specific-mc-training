-- Fix google search count permissions and create missing functions
-- This migration creates missing functions and grants execute permissions

-- Create missing function: get_user_google_search_count
CREATE OR REPLACE FUNCTION get_user_google_search_count(p_line_user_id TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(google_search_count, 0)
    FROM users 
    WHERE line_user_id = p_line_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create missing function: increment_google_search_count_by_line_id
CREATE OR REPLACE FUNCTION increment_google_search_count_by_line_id(p_line_user_id TEXT)
RETURNS VOID AS $$
BEGIN
  -- ユーザーの存在確認
  IF NOT EXISTS (SELECT 1 FROM users WHERE line_user_id = p_line_user_id) THEN
    RAISE EXCEPTION 'User not found: %', p_line_user_id;
  END IF;
  
  UPDATE users 
  SET google_search_count = COALESCE(google_search_count, 0) + 1,
      updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
  WHERE line_user_id = p_line_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for get_user_google_search_count function
GRANT EXECUTE ON FUNCTION get_user_google_search_count(text) TO anon;
GRANT EXECUTE ON FUNCTION get_user_google_search_count(text) TO authenticated;

-- Grant permissions for increment_google_search_count function
GRANT EXECUTE ON FUNCTION increment_google_search_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION increment_google_search_count(uuid) TO authenticated;
ALTER FUNCTION increment_google_search_count(uuid) SECURITY DEFINER;

-- Grant permissions for increment_google_search_count_by_line_id function
GRANT EXECUTE ON FUNCTION increment_google_search_count_by_line_id(text) TO anon;
GRANT EXECUTE ON FUNCTION increment_google_search_count_by_line_id(text) TO authenticated;

-- Grant necessary table permissions
GRANT SELECT ON users TO anon;
GRANT SELECT ON users TO authenticated;
GRANT INSERT ON users TO anon;
GRANT INSERT ON users TO authenticated;
GRANT UPDATE ON users TO anon;
GRANT UPDATE ON users TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_user_google_search_count(text) IS 'Returns the google search count for a user by LINE user ID. Accessible by anon and authenticated roles.';
COMMENT ON FUNCTION increment_google_search_count(uuid) IS 'Increments the google search count for a user by user ID. Accessible by anon and authenticated roles.';
COMMENT ON FUNCTION increment_google_search_count_by_line_id(text) IS 'Increments the google search count for a user by LINE user ID. Accessible by anon and authenticated roles.';