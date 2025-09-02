-- Enable RLS to avoid public access via anon key
alter table if exists public.content_annotations enable row level security;

-- No policies are added intentionally. With RLS enabled and no policies,
-- anon service cannot read/write, while Service Role (server) still bypasses RLS.


