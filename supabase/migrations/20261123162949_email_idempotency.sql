-- A sync retry must not create a second task for the same email.
create unique index if not exists items_email_source_unique
  on public.items (user_id, source, source_ref);

