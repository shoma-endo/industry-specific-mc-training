-- Create content_categories table for user-defined category management
CREATE TABLE IF NOT EXISTS public.content_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6b7280',
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_content_categories_user_id ON public.content_categories(user_id);

-- Enable RLS
ALTER TABLE public.content_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own categories"
  ON public.content_categories FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own categories"
  ON public.content_categories FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own categories"
  ON public.content_categories FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their own categories"
  ON public.content_categories FOR DELETE
  USING (true);

-- Create content_annotation_categories junction table
CREATE TABLE IF NOT EXISTS public.content_annotation_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id uuid NOT NULL REFERENCES public.content_annotations(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.content_categories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(annotation_id, category_id)
);

-- Create indexes for junction table
CREATE INDEX IF NOT EXISTS idx_content_annotation_categories_annotation ON public.content_annotation_categories(annotation_id);
CREATE INDEX IF NOT EXISTS idx_content_annotation_categories_category ON public.content_annotation_categories(category_id);

-- Enable RLS
ALTER TABLE public.content_annotation_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for junction table
CREATE POLICY "Users can view their annotation categories"
  ON public.content_annotation_categories FOR SELECT
  USING (true);

CREATE POLICY "Users can insert annotation categories"
  ON public.content_annotation_categories FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete annotation categories"
  ON public.content_annotation_categories FOR DELETE
  USING (true);

-- Rollback
-- DROP TABLE IF EXISTS public.content_annotation_categories;
-- DROP TABLE IF EXISTS public.content_categories;
