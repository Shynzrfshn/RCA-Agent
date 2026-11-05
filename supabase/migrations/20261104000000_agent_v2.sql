-- RCA Agent v2: reminders, medications, email, chat, memory, push.
-- Run AFTER supabase/schema.sql (v1). Safe to run more than once.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Profiles (timezone, briefing time)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Tehran',
  briefing_hour smallint not null default 7 check (briefing_hour between 0 and 23),
  briefing_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile for each new user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.profiles (user_id) select id from auth.users on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Items: add due dates, priority, recurrence, source
-- ---------------------------------------------------------------------------
alter table public.items add column if not exists due_at timestamptz;
alter table public.items add column if not exists priority smallint not null default 1
  check (priority between 0 and 3); -- 0 low, 1 normal, 2 high, 3 urgent
alter table public.items add column if not exists recurrence text
  check (recurrence in ('daily', 'weekly', 'monthly'));
alter table public.items add column if not exists notified_at timestamptz;
alter table public.items add column if not exists source text not null default 'manual'
  check (source in ('manual', 'agent', 'email'));
alter table public.items add column if not exists source_ref text;
alter table public.items add column if not exists completed_at timestamptz;
create index if not exists items_due_idx on public.items (due_at) where done = false;

-- Completing a recurring item moves it to its next occurrence instead.
create or replace function public._complete_item(p_id uuid, p_done boolean, p_user uuid)
returns public.items language plpgsql security definer set search_path = public as $$
declare
  it public.items;
  step interval;
  next_due timestamptz;
begin
  select * into it from public.items where id = p_id and user_id = p_user;
  if not found then raise exception 'item not found'; end if;

  if p_done and it.recurrence is not null and it.due_at is not null then
    step := case it.recurrence when 'daily' then interval '1 day'
                               when 'weekly' then interval '7 days'
                               else interval '1 month' end;
    next_due := it.due_at + step;
    while next_due <= now() loop
      next_due := next_due + step;
    end loop;
    update public.items
       set due_at = next_due, notified_at = null
     where id = p_id
     returning * into it;
  else
    update public.items
       set done = p_done, completed_at = case when p_done then now() end
     where id = p_id
     returning * into it;
  end if;
  return it;
end $$;
revoke execute on function public._complete_item(uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public._complete_item(uuid, boolean, uuid) to service_role;

create or replace function public.complete_item(p_id uuid, p_done boolean default true)
returns public.items language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return public._complete_item(p_id, p_done, auth.uid());
end $$;
revoke execute on function public.complete_item(uuid, boolean) from public, anon;
grant execute on function public.complete_item(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Medications and dose log
-- ---------------------------------------------------------------------------
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text,                        -- e.g. "500mg", "1 tablet"
  instructions text,                  -- e.g. "after meal"
  times text[] not null default '{08:00}', -- local HH:MM
  days_of_week smallint[],            -- 0=Sun..6=Sat, null = every day
  start_date date not null default current_date,
  end_date date,
  stock numeric,                      -- remaining units, null = untracked
  dose_amount numeric not null default 1,
  refill_threshold numeric not null default 5,
  refill_notified_on date,
  color text not null default '#6366f1',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.medications enable row level security;
drop policy if exists "own medications" on public.medications;
create policy "own medications" on public.medications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'taken', 'skipped', 'missed')),
  taken_at timestamptz,
  snooze_until timestamptz,
  notify_count smallint not null default 0,
  last_notified_at timestamptz,
  unique (medication_id, scheduled_for)
);
alter table public.dose_logs enable row level security;
drop policy if exists "own doses" on public.dose_logs;
create policy "own doses" on public.dose_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists dose_logs_user_time_idx on public.dose_logs (user_id, scheduled_for);
create index if not exists dose_logs_pending_idx on public.dose_logs (scheduled_for) where status = 'pending';

-- Materialize dose rows for the next p_days days in each user's timezone.
create or replace function public.ensure_dose_logs(p_days int default 2, p_user uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.dose_logs (user_id, medication_id, scheduled_for)
  select m.user_id, m.id, ((d::date + t::time) at time zone coalesce(p.timezone, 'Asia/Tehran'))
    from public.medications m
    left join public.profiles p on p.user_id = m.user_id
    cross join lateral unnest(m.times) t
    cross join lateral generate_series(
      (now() at time zone coalesce(p.timezone, 'Asia/Tehran'))::date,
      (now() at time zone coalesce(p.timezone, 'Asia/Tehran'))::date + p_days, interval '1 day') d
   where m.active
     and (p_user is null or m.user_id = p_user)
     and d::date >= m.start_date
     and (m.end_date is null or d::date <= m.end_date)
     and (m.days_of_week is null or extract(dow from d)::smallint = any(m.days_of_week))
     and ((d::date + t::time) at time zone coalesce(p.timezone, 'Asia/Tehran')) > m.created_at - interval '1 minute'
  on conflict (medication_id, scheduled_for) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.ensure_dose_logs(int, uuid) from public, anon, authenticated;
grant execute on function public.ensure_dose_logs(int, uuid) to service_role;

-- Users may only materialize their own doses.
create or replace function public.ensure_my_doses()
returns int language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return public.ensure_dose_logs(2, auth.uid());
end $$;
revoke execute on function public.ensure_my_doses() from public, anon;
grant execute on function public.ensure_my_doses() to authenticated;

-- Mark a dose taken/skipped/pending (undo). Keeps stock in sync.
create or replace function public._set_dose_status(p_log uuid, p_status text, p_user uuid)
returns public.dose_logs language plpgsql security definer set search_path = public as $$
declare
  rec public.dose_logs;
  prev text;
begin
  if p_status not in ('pending', 'taken', 'skipped', 'missed') then
    raise exception 'bad status';
  end if;
  select status into prev from public.dose_logs where id = p_log and user_id = p_user;
  if not found then raise exception 'dose not found'; end if;
  update public.dose_logs
     set status = p_status,
         taken_at = case when p_status = 'taken' then now() end,
         snooze_until = null
   where id = p_log
   returning * into rec;
  if prev <> 'taken' and p_status = 'taken' then
    update public.medications set stock = stock - dose_amount
     where id = rec.medication_id and stock is not null;
  elsif prev = 'taken' and p_status <> 'taken' then
    update public.medications set stock = stock + dose_amount
     where id = rec.medication_id and stock is not null;
  end if;
  return rec;
end $$;
revoke execute on function public._set_dose_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public._set_dose_status(uuid, text, uuid) to service_role;

create or replace function public.set_dose_status(p_log uuid, p_status text)
returns public.dose_logs language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return public._set_dose_status(p_log, p_status, auth.uid());
end $$;
revoke execute on function public.set_dose_status(uuid, text) from public, anon;
grant execute on function public.set_dose_status(uuid, text) to authenticated;

-- Adherence stats per day for the last p_days days.
create or replace function public.adherence(p_days int default 14)
returns table (day date, taken int, total int)
language sql security invoker set search_path = public as $$
  select (l.scheduled_for at time zone coalesce(p.timezone, 'Asia/Tehran'))::date as day,
         count(*) filter (where l.status = 'taken')::int,
         count(*)::int
    from public.dose_logs l
    left join public.profiles p on p.user_id = l.user_id
   where l.user_id = auth.uid()
     and l.scheduled_for <= now()
     and l.scheduled_for > now() - make_interval(days => p_days)
   group by 1 order by 1;
$$;

-- ---------------------------------------------------------------------------
-- Web push subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push" on public.push_subscriptions;
create policy "own push" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Email accounts (secrets live in a table only the service role can read)
-- ---------------------------------------------------------------------------
create table if not exists public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'gmail' check (provider in ('gmail')),
  email text not null,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, provider, email)
);
alter table public.email_accounts enable row level security;
drop policy if exists "own email accounts read" on public.email_accounts;
create policy "own email accounts read" on public.email_accounts
  for select using (auth.uid() = user_id);
drop policy if exists "own email accounts delete" on public.email_accounts;
create policy "own email accounts delete" on public.email_accounts
  for delete using (auth.uid() = user_id);

create table if not exists public.email_credentials (
  account_id uuid primary key references public.email_accounts(id) on delete cascade,
  refresh_token_enc text not null,   -- AES-GCM encrypted, see functions/_shared/crypto.ts
  updated_at timestamptz not null default now()
);
alter table public.email_credentials enable row level security;
-- no policies: only the service role (edge functions) can touch this table.

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.email_accounts(id) on delete cascade,
  provider_id text not null,
  thread_id text,
  from_addr text,
  subject text,
  snippet text,
  received_at timestamptz,
  category text not null default 'normal'
    check (category in ('urgent', 'important', 'normal', 'promo', 'spam')),
  summary text,
  action_needed boolean not null default false,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (account_id, provider_id)
);
alter table public.emails enable row level security;
drop policy if exists "own emails" on public.emails;
create policy "own emails" on public.emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists emails_user_received_idx on public.emails (user_id, received_at desc);

-- ---------------------------------------------------------------------------
-- Agent: chat history, long-term memory, audit log, daily briefings
-- ---------------------------------------------------------------------------
create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.agent_messages enable row level security;
drop policy if exists "own messages" on public.agent_messages;
create policy "own messages" on public.agent_messages
  for select using (auth.uid() = user_id);
drop policy if exists "own messages delete" on public.agent_messages;
create policy "own messages delete" on public.agent_messages
  for delete using (auth.uid() = user_id);
create index if not exists agent_messages_user_idx on public.agent_messages (user_id, created_at desc);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.memories enable row level security;
drop policy if exists "own memories" on public.memories;
create policy "own memories" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  input jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);
alter table public.agent_actions enable row level security;
drop policy if exists "own actions" on public.agent_actions;
create policy "own actions" on public.agent_actions
  for select using (auth.uid() = user_id);

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);
alter table public.briefings enable row level security;
drop policy if exists "own briefings" on public.briefings;
create policy "own briefings" on public.briefings
  for select using (auth.uid() = user_id);
