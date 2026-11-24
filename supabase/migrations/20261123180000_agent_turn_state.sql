-- Make idempotent agent turns observable and explicitly recoverable.
alter table public.agent_turns
  add column if not exists status text not null default 'running',
  add column if not exists error_code text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.agent_turns drop constraint if exists agent_turns_status_check;
alter table public.agent_turns add constraint agent_turns_status_check
  check (status in ('running', 'awaiting_confirmation', 'completed', 'failed', 'cancelled'));

update public.agent_turns
set status = case when result is null then 'failed' else 'completed' end,
    error_code = case when result is null then 'legacy_incomplete_turn' else null end,
    updated_at = coalesce(updated_at, created_at);

create index if not exists agent_turns_status_updated_idx
  on public.agent_turns(status, updated_at);

