-- Phase 2: proactive agent — evening/weekly reviews and nudges. Idempotent.

alter table public.profiles add column if not exists evening_hour smallint not null default 21
  check (evening_hour between 0 and 23);
alter table public.profiles add column if not exists evening_enabled boolean not null default true;
alter table public.profiles add column if not exists weekly_day smallint not null default 5
  check (weekly_day between 0 and 6); -- 0=Sun .. 5=Fri
alter table public.profiles add column if not exists nudges_enabled boolean not null default true;

-- Briefings now have a kind: morning, evening, weekly.
alter table public.briefings add column if not exists kind text not null default 'morning'
  check (kind in ('morning', 'evening', 'weekly'));
alter table public.briefings drop constraint if exists briefings_user_id_day_key;
create unique index if not exists briefings_user_day_kind_key on public.briefings (user_id, day, kind);

-- Proactive nudges: short rule-based observations, at most one per key per day.
create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,          -- e.g. 'overdue', 'missed-doses', 'urgent-mail'
  day date not null,
  title text not null,
  body text not null,
  url text,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, key, day)
);
alter table public.nudges enable row level security;
drop policy if exists "own nudges read" on public.nudges;
create policy "own nudges read" on public.nudges for select using (auth.uid() = user_id);
drop policy if exists "own nudges dismiss" on public.nudges;
create policy "own nudges dismiss" on public.nudges for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
