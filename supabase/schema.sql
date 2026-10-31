-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task', 'note', 'reminder', 'idea')),
  content text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;

create policy "Users manage their own items"
  on public.items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists items_user_id_created_at_idx
  on public.items (user_id, created_at desc);
