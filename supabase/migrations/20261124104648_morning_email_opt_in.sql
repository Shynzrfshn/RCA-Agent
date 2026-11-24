-- Morning email is strictly opt-in. No existing account starts receiving mail.
alter table public.profiles
  add column if not exists morning_email_enabled boolean not null default false;

create table if not exists public.morning_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists morning_email_deliveries_day_idx on public.morning_email_deliveries(day, status);
alter table public.morning_email_deliveries enable row level security;
-- The service role writes deliveries; owners may only inspect their own status.
create policy "read own morning delivery" on public.morning_email_deliveries
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.morning_email_deliveries from anon, authenticated;
grant select on public.morning_email_deliveries to authenticated;

