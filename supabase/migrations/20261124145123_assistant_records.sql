-- Structured assistant-managed records, additive and user-owned.
create table if not exists public.assistant_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bill', 'document', 'followup', 'appointment', 'stock')),
  title text not null check (char_length(title) between 1 and 200),
  details text,
  counterparty text,
  due_at timestamptz,
  amount numeric,
  quantity numeric,
  threshold numeric,
  status text not null default 'active' check (status in ('active', 'done', 'response_detected')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount is null or amount >= 0),
  check (quantity is null or quantity >= 0),
  check (threshold is null or threshold >= 0)
);
create index if not exists assistant_records_user_category_idx on public.assistant_records(user_id, category, status);
create index if not exists assistant_records_due_idx on public.assistant_records(due_at) where status = 'active';
alter table public.assistant_records enable row level security;
create policy "read own assistant records" on public.assistant_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own assistant records" on public.assistant_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own assistant records" on public.assistant_records
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update on public.assistant_records to authenticated;

create table if not exists public.assistant_record_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid not null references public.assistant_records(id) on delete cascade,
  previous jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.assistant_record_versions enable row level security;
create policy "read own record versions" on public.assistant_record_versions
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.assistant_record_versions from anon, authenticated;
grant select on public.assistant_record_versions to authenticated;
create index if not exists assistant_record_versions_record_idx on public.assistant_record_versions(record_id, created_at desc);

create or replace function private.capture_assistant_record_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.assistant_record_versions(user_id, record_id, previous)
  values (old.user_id, old.id, to_jsonb(old));
  return new;
end $$;
revoke execute on function private.capture_assistant_record_version() from public, anon, authenticated;
create trigger capture_assistant_record_version_before_update
  before update of title, details, counterparty, due_at, amount, quantity, threshold, status
  on public.assistant_records for each row
  execute function private.capture_assistant_record_version();

