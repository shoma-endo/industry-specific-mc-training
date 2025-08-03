-- up -------------------------------------------
ALTER TABLE prompt_templates
  DROP CONSTRAINT IF EXISTS prompt_templates_created_by_fkey;

ALTER TABLE prompt_templates
  ADD CONSTRAINT prompt_templates_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL;

-- down -----------------------------------------
ALTER TABLE prompt_templates
  DROP CONSTRAINT IF EXISTS prompt_templates_created_by_fkey;

ALTER TABLE prompt_templates
  ADD CONSTRAINT prompt_templates_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE NO ACTION;