-- ==============================================================================
-- GridFlow v4: Cloud-Synced User Sandboxes for SQL Learner Laboratory
-- Allows each SREC student and staff user to sync their personal database
-- mutations, query editor drafts, execution history, and AI chat logs.
-- ==============================================================================

create table if not exists public.user_sandboxes (
  email text primary key,
  sandbox_tables jsonb not null default '{}'::jsonb,
  editor_draft text,
  query_history jsonb not null default '[]'::jsonb,
  chat_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Grant full API access to anon, authenticated, and service_role
grant usage on schema public to anon, authenticated, service_role;
grant all on table public.user_sandboxes to anon, authenticated, service_role;
