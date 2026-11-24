-- These client RPC wrappers operate directly on rows allowed by RLS and do not
-- need elevated privileges. Internal service-role helpers remain private.
create or replace function public.complete_item(p_id uuid, p_done boolean default true)
returns public.items language plpgsql security invoker set search_path = public as $$
declare
  it public.items;
  step interval;
  next_due timestamptz;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into it from public.items where id = p_id and user_id = auth.uid();
  if not found then raise exception 'item not found'; end if;
  if p_done and it.recurrence is not null and it.due_at is not null then
    step := case it.recurrence when 'daily' then interval '1 day'
                               when 'weekly' then interval '7 days'
                               else interval '1 month' end;
    next_due := it.due_at + step;
    while next_due <= now() loop next_due := next_due + step; end loop;
    update public.items set due_at = next_due, notified_at = null
      where id = p_id and user_id = auth.uid() returning * into it;
  else
    update public.items set done = p_done,
      completed_at = case when p_done then now() else null end
      where id = p_id and user_id = auth.uid() returning * into it;
  end if;
  return it;
end $$;

create or replace function public.ensure_my_doses()
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.dose_logs (user_id, medication_id, scheduled_for)
  select m.user_id, m.id, ((d::date + t::time) at time zone coalesce(p.timezone, 'Asia/Tehran'))
    from public.medications m
    left join public.profiles p on p.user_id = m.user_id
    cross join lateral unnest(m.times) t
    cross join lateral generate_series(
      (now() at time zone coalesce(p.timezone, 'Asia/Tehran'))::date,
      (now() at time zone coalesce(p.timezone, 'Asia/Tehran'))::date + 2, interval '1 day') d
   where m.user_id = auth.uid() and m.active
     and d::date >= m.start_date
     and (m.end_date is null or d::date <= m.end_date)
     and (m.days_of_week is null or extract(dow from d)::smallint = any(m.days_of_week))
     and ((d::date + t::time) at time zone coalesce(p.timezone, 'Asia/Tehran')) > m.created_at - interval '1 minute'
  on conflict (medication_id, scheduled_for) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.set_dose_status(p_log uuid, p_status text)
returns public.dose_logs language plpgsql security invoker set search_path = public as $$
declare
  rec public.dose_logs;
  previous text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_status not in ('pending', 'taken', 'skipped', 'missed') then raise exception 'bad status'; end if;
  select status into previous from public.dose_logs where id = p_log and user_id = auth.uid();
  if not found then raise exception 'dose not found'; end if;
  update public.dose_logs set status = p_status,
    taken_at = case when p_status = 'taken' then now() else null end,
    snooze_until = null
    where id = p_log and user_id = auth.uid() returning * into rec;
  if previous <> 'taken' and p_status = 'taken' then
    update public.medications set stock = stock - dose_amount
      where id = rec.medication_id and user_id = auth.uid() and stock is not null;
  elsif previous = 'taken' and p_status <> 'taken' then
    update public.medications set stock = stock + dose_amount
      where id = rec.medication_id and user_id = auth.uid() and stock is not null;
  end if;
  return rec;
end $$;

revoke execute on function public.complete_item(uuid, boolean) from public, anon;
revoke execute on function public.ensure_my_doses() from public, anon;
revoke execute on function public.set_dose_status(uuid, text) from public, anon;
grant execute on function public.complete_item(uuid, boolean) to authenticated;
grant execute on function public.ensure_my_doses() to authenticated;
grant execute on function public.set_dose_status(uuid, text) to authenticated;

