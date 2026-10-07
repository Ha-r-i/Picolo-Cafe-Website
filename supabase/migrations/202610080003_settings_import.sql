create table cafe_private.imported_sources (
  kind text not null check(kind in ('category','menu','reservation')), legacy_id text not null,
  checksum text not null check(length(checksum)=64), imported_at timestamptz not null default now(),
  primary key(kind,legacy_id)
);
revoke all on cafe_private.imported_sources from public,anon,authenticated,service_role,cafe_api;
create function cafe_private.validate_settings() returns trigger language plpgsql security definer set search_path='' as $$
declare day integer; hours jsonb; peak integer; begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Invalid cafe timezone'; end if;
  if jsonb_typeof(new.opening_hours)<>'object' or (select count(*) from jsonb_object_keys(new.opening_hours))<>7 then raise exception 'Specify all seven opening days'; end if;
  for day in 0..6 loop
    hours:=new.opening_hours->day::text;
    if hours is null then raise exception 'Missing opening day'; end if;
    if hours<>'null'::jsonb then
      if jsonb_typeof(hours)<>'object' or (hours->>'open') is null or (hours->>'close') is null
        or (hours->>'open') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (hours->>'close') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or (hours->>'open')::time>=(hours->>'close')::time
        or extract(minute from (hours->>'open')::time)::integer%new.slot_minutes<>0 then
        raise exception 'Opening hours must be aligned slots within one calendar day';
      end if;
    end if;
  end loop;
  -- Configuration changes use the same settings row lock as booking operations.
  select coalesce(max(cafe_private.peak_seats(starts_at,ends_at)),0) into peak from public.reservations where status in ('pending','confirmed','seated');
  if new.capacity<peak then raise exception 'Capacity cannot be lowered below existing active bookings'; end if;
  new.updated_at:=clock_timestamp();return new;
end $$;
revoke all on function cafe_private.validate_settings() from public,anon,authenticated,service_role,cafe_api;
create trigger settings_valid before update on cafe_private.settings for each row execute function cafe_private.validate_settings();
