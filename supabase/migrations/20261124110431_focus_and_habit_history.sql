alter table public.profiles
  add column if not exists focus_mode_enabled boolean not null default false;

create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  completed_on date not null,
  created_at timestamptz not null default now(),
  unique (item_id, completed_on)
);
alter table public.habit_completions enable row level security;
create policy "read own habit completions" on public.habit_completions
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.habit_completions from anon, authenticated;
grant select on public.habit_completions to authenticated;
create index if not exists habit_completions_user_day_idx on public.habit_completions(user_id, completed_on desc);

-- Existing recurring tasks become trackable habits from this migration onward.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.record_recurring_completion()
returns trigger language plpgsql security definer set search_path = public as $$
declare user_tz text;
begin
  if old.recurrence is not null and old.due_at is not null
     and new.due_at is distinct from old.due_at and new.due_at > old.due_at then
    select timezone into user_tz from public.profiles where user_id = old.user_id;
    insert into public.habit_completions(user_id, item_id, completed_on)
    values (old.user_id, old.id, (old.due_at at time zone coalesce(user_tz, 'Asia/Tehran'))::date)
    on conflict (item_id, completed_on) do nothing;
  end if;
  return new;
end $$;
revoke execute on function private.record_recurring_completion() from public, anon, authenticated;
create trigger record_recurring_completion_after_update
  after update of due_at on public.items for each row
  execute function private.record_recurring_completion();

