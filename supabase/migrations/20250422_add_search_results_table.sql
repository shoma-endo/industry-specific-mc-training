CREATE TABLE IF NOT EXISTS search_results (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  session_id   TEXT    REFERENCES chat_sessions(id) ON DELETE CASCADE,
  query        TEXT    NOT NULL,
  result_index INT     NOT NULL,
  title        TEXT    NOT NULL,
  snippet      TEXT    NOT NULL,
  link         TEXT    NOT NULL,
  created_at   BIGINT  NOT NULL
);
