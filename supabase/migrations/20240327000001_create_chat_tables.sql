CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  system_prompt TEXT,
  last_message_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  created_at BIGINT NOT NULL
);

-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "開発環境用全許可ポリシー_chat_sessions" ON chat_sessions
  FOR ALL USING (true);

CREATE POLICY "開発環境用全許可ポリシー_chat_messages" ON chat_messages
  FOR ALL USING (true);

-- CREATE POLICY "ユーザー所有データのみ許可_chat_sessions" ON chat_sessions
--   FOR ALL USING (user_id = current_setting('app.user_id', true)::text);

-- CREATE POLICY "ユーザー所有データのみ許可_chat_messages" ON chat_messages
--   FOR ALL USING (user_id = current_setting('app.user_id', true)::text);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_created_at_idx ON chat_sessions (created_at);
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages (session_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages (user_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages (created_at);
