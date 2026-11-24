alter table public.email_accounts add column if not exists sync_claim_until timestamptz;

