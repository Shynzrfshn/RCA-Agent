-- Idempotent agent turns. Only service-role Edge Functions access this table.
create table if not exists public.agent_turns (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.agent_turns enable row level security;
create index if not exists agent_turns_created_idx on public.agent_turns(created_at);

