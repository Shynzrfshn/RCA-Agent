-- Explicit opt-in before automatic personal data is sent to LLM providers.
alter table public.profiles add column if not exists ai_sensitive_enabled boolean not null default false;

