-- up -------------------------------------------
ALTER TABLE prompt_versions
  DROP CONSTRAINT IF EXISTS prompt_versions_created_by_fkey;

ALTER TABLE prompt_versions
  ADD CONSTRAINT prompt_versions_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL;

-- down -----------------------------------------
ALTER TABLE prompt_versions
  DROP CONSTRAINT IF EXISTS prompt_versions_created_by_fkey;

ALTER TABLE prompt_versions
  ADD CONSTRAINT prompt_versions_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE NO ACTION;