-- Single cafe, seat-based capacity. Runtime connects as cafe_api, never postgres.
create schema if not exists cafe_private;
revoke all on schema cafe_private from public, anon, authenticated, service_role;
do $$ begin create role cafe_api nologin noinherit; exception when duplicate_object then null; end $$;
grant usage on schema public, cafe_private to cafe_api;
alter default privileges in schema cafe_private revoke execute on functions from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','staff','admin')),
  created_at timestamptz not null default now()
);
create function cafe_private.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values(new.id) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function cafe_private.new_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;

create table public.categories (
  id uuid primary key default gen_random_uuid(), slug text unique not null check(length(slug) between 1 and 80),
  name text not null check(length(name) between 1 and 100), position integer not null default 0,
  legacy_id text unique, created_at timestamptz not null default now()
);
create table public.menu_items (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check(length(name) between 1 and 120), description text not null default '' check(length(description)<=1000),
  price_paise integer not null check(price_paise between 0 and 10000000),
  dietary text not null default 'vegetarian' check(dietary in ('vegetarian','vegan','non_vegetarian')),
  image_path text, published boolean not null default false, featured boolean not null default false,
  sample_data boolean not null default false, version integer not null default 1 check(version>0), legacy_id text unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(image_path is null or image_path ~ '^menu/[a-zA-Z0-9/_\.\-]+\.webp$')
);
create index menu_public_category on public.menu_items(category_id,name,id) where published;

create table cafe_private.settings (
  id boolean primary key default true check(id), timezone text not null default 'Asia/Kolkata',
  capacity integer not null default 24 check(capacity between 1 and 1000),
  duration_minutes integer not null default 90 check(duration_minutes between 15 and 240),
  slot_minutes integer not null default 30 check(slot_minutes in (15,30,60)),
  lead_minutes integer not null default 120 check(lead_minutes between 0 and 10080),
  cancellation_minutes integer not null default 120 check(cancellation_minutes between 0 and 10080),
  max_party_size integer not null default 10 check(max_party_size between 1 and 50 and max_party_size<=capacity),
  horizon_days integer not null default 60 check(horizon_days between 1 and 365),
  opening_hours jsonb not null default '{"0":{"open":"09:00","close":"22:00"},"1":{"open":"09:00","close":"22:00"},"2":{"open":"09:00","close":"22:00"},"3":{"open":"09:00","close":"22:00"},"4":{"open":"09:00","close":"22:00"},"5":{"open":"09:00","close":"22:00"},"6":{"open":"09:00","close":"22:00"}}',
  updated_at timestamptz not null default now()
);
insert into cafe_private.settings(id) values(true);

create table public.reservations (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  name text not null check(length(name) between 2 and 100), email text not null check(length(email)<=254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null check(phone ~ '^\+?[0-9 ()-]{7,20}$'),
  starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
  guests integer not null check(guests between 1 and 50), notes text not null default '' check(length(notes)<=1000),
  status text not null default 'pending' check(status in ('pending','confirmed','seated','completed','cancelled','rejected','no_show')),
  version integer not null default 1 check(version>0), legacy_id text unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index reservation_active_range on public.reservations using gist (tstzrange(starts_at,ends_at,'[)')) where status in ('pending','confirmed','seated');
create index reservation_staff_order on public.reservations(starts_at,id);
create index reservation_status_order on public.reservations(status,starts_at,id);
create index reservation_customer on public.reservations(user_id,starts_at desc) where user_id is not null;

create table cafe_private.guest_access (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  token_hash text not null check(length(token_hash)=64)
);
create table cafe_private.booking_requests (
  key uuid primary key, actor_id uuid, fingerprint text not null check(length(fingerprint)=64),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  response jsonb not null, created_at timestamptz not null default now()
);
create table public.reservation_audit (
  id bigint generated always as identity primary key, reservation_id uuid not null references public.reservations(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null, actor_kind text not null check(actor_kind in ('customer','guest','staff','admin','migration')),
  from_status text, to_status text not null, version integer not null, created_at timestamptz not null default now(),
  unique(reservation_id,version)
);
create index audit_reservation on public.reservation_audit(reservation_id,id);
create table cafe_private.notification_outbox (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.reservations(id) on delete restrict,
  version integer not null, payload jsonb not null, status text not null default 'pending' check(status in ('pending','processing','sent','dead')),
  attempts integer not null default 0, available_at timestamptz not null default now(), lease_until timestamptz,
  lease_token uuid, first_attempt_at timestamptz, provider_id text, last_error text,
  created_at timestamptz not null default now(), sent_at timestamptz, unique(reservation_id,version)
);
create index outbox_due on cafe_private.notification_outbox(available_at,created_at) where status in ('pending','processing');
create table cafe_private.request_limits (
  key text primary key, window_start timestamptz not null, hits integer not null check(hits>0)
);

-- The peak may occur at the new interval start OR any existing interval start.
-- Summing all intersecting parties would incorrectly reject back-to-back visits.
create function cafe_private.peak_seats(p_start timestamptz,p_end timestamptz,p_exclude uuid default null)
returns integer language sql volatile set search_path = '' as $$
  with active as (
    select starts_at, ends_at, guests from public.reservations
    where status in ('pending','confirmed','seated') and id is distinct from p_exclude
      and tstzrange(starts_at,ends_at,'[)') && tstzrange(p_start,p_end,'[)')
  ), points as (select p_start as at union select starts_at from active where starts_at>=p_start)
  select coalesce(max((select coalesce(sum(guests),0) from active where starts_at<=points.at and ends_at>points.at)),0)::integer from points;
$$;
create function cafe_private.guard_capacity() returns trigger language plpgsql security definer set search_path = '' as $$
declare s cafe_private.settings; begin
  -- This row lock is shared by every instance and all capacity-changing operations.
  select * into s from cafe_private.settings where id for update;
  if new.status in ('pending','confirmed','seated') and
     cafe_private.peak_seats(new.starts_at,new.ends_at,new.id)+new.guests>s.capacity then
    raise exception using errcode='P0001',message='CAPACITY_EXCEEDED';
  end if;
  return new;
end $$;
create trigger reservation_capacity before insert or update of status,starts_at,ends_at,guests on public.reservations for each row execute function cafe_private.guard_capacity();

create function cafe_private.record_reservation() returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid; kind text; begin
  actor := nullif(current_setting('cafe.actor_id',true),'')::uuid;
  kind := coalesce(nullif(current_setting('cafe.actor_kind',true),''),'migration');
  insert into public.reservation_audit(reservation_id,actor_id,actor_kind,from_status,to_status,version)
  values(new.id,actor,kind,case when tg_op='INSERT' then null else old.status end,new.status,new.version);
  -- Imports retain historical data without sending unexpected customer mail.
  if kind <> 'migration' then
    insert into cafe_private.notification_outbox(reservation_id,version,payload)
    values(new.id,new.version,jsonb_build_object('email',new.email,'name',new.name,'starts_at',new.starts_at,'ends_at',new.ends_at,'guests',new.guests,'status',new.status,'reservation_id',new.id));
  end if;
  return new;
end $$;
create trigger reservation_history after insert or update of status on public.reservations for each row execute function cafe_private.record_reservation();

create function cafe_private.create_booking(p_actor uuid,p_key uuid,p_fingerprint text,p_token_hash text,p_data jsonb,p_ip_rate text default null,p_email_rate text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s cafe_private.settings; old_request cafe_private.booking_requests; r public.reservations;
  start_time timestamptz; local_start timestamp; local_end timestamp; hours jsonb; kind text;
begin
  select * into s from cafe_private.settings where id for update;
  select * into old_request from cafe_private.booking_requests where key=p_key;
  if found then
    if old_request.actor_id is distinct from p_actor or old_request.fingerprint<>p_fingerprint then
      raise exception using errcode='P0001',message='IDEMPOTENCY_MISMATCH';
    end if;
    return jsonb_build_object('reservation',old_request.response,'replayed',true);
  end if;
  if p_actor is not null and not exists(select 1 from public.profiles where id=p_actor) then
    raise exception using errcode='P0001',message='UNAUTHORIZED';
  end if;
  if p_actor is null and (p_token_hash is null or length(p_token_hash)<>64) then
    raise exception using errcode='P0001',message='INVALID_INPUT';
  end if;
  start_time := (p_data->>'starts_at')::timestamptz;
  local_start := start_time at time zone s.timezone;
  local_end := (start_time+make_interval(mins=>s.duration_minutes)) at time zone s.timezone;
  hours := s.opening_hours->extract(dow from local_start)::integer::text;
  if start_time<clock_timestamp()+make_interval(mins=>s.lead_minutes)
     or local_start::date>(clock_timestamp() at time zone s.timezone)::date+s.horizon_days
     or (p_data->>'guests')::integer>s.max_party_size
     or extract(second from local_start)<>0 or extract(minute from local_start)::integer%s.slot_minutes<>0
     or hours is null or hours='null'::jsonb or local_start::date<>local_end::date
     or local_start::time<(hours->>'open')::time or local_end::time>(hours->>'close')::time then
    raise exception using errcode='P0001',message='OUTSIDE_BOOKING_RULES';
  end if;
  kind := case when p_actor is null then 'guest' else 'customer' end;
  -- Retries resolve above before consuming limits. Only a new booking charges
  -- these durable budgets, within the same transaction as the booking itself.
  if (p_ip_rate is not null and not cafe_private.consume_limit(p_ip_rate,8,3600))
     or (p_email_rate is not null and not cafe_private.consume_limit(p_email_rate,8,3600)) then
    raise exception using errcode='P0001',message='RATE_LIMITED';
  end if;
  perform set_config('cafe.actor_id',coalesce(p_actor::text,''),true);
  perform set_config('cafe.actor_kind',kind,true);
  insert into public.reservations(user_id,name,email,phone,starts_at,ends_at,guests,notes)
  values(p_actor,p_data->>'name',lower(p_data->>'email'),p_data->>'phone',start_time,start_time+make_interval(mins=>s.duration_minutes),(p_data->>'guests')::integer,coalesce(p_data->>'notes','')) returning * into r;
  if p_actor is null then insert into cafe_private.guest_access values(r.id,p_token_hash); end if;
  insert into cafe_private.booking_requests(key,actor_id,fingerprint,reservation_id,response) values(p_key,p_actor,p_fingerprint,r.id,to_jsonb(r));
  return jsonb_build_object('reservation',to_jsonb(r),'replayed',false);
end $$;

create function cafe_private.change_booking(p_actor uuid,p_token_hash text,p_id uuid,p_version integer,p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s cafe_private.settings; r public.reservations; role_name text; permitted boolean; begin
  select * into s from cafe_private.settings where id for update;
  select * into r from public.reservations where id=p_id for update;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  select role into role_name from public.profiles where id=p_actor;
  if role_name in ('staff','admin') then
    permitted := true;
  elsif (p_actor is not null and r.user_id=p_actor) or
        exists(select 1 from cafe_private.guest_access where reservation_id=p_id and token_hash=p_token_hash) then
    permitted := p_status='cancelled' and r.status in ('pending','confirmed') and r.starts_at>=clock_timestamp()+make_interval(mins=>s.cancellation_minutes);
  else raise exception using errcode='P0001',message='NOT_FOUND'; end if;
  if not coalesce(permitted,false) then raise exception using errcode='P0001',message='FORBIDDEN'; end if;
  if r.version<>p_version then raise exception using errcode='P0001',message='STALE_VERSION'; end if;
  if not ((r.status='pending' and p_status in ('confirmed','cancelled','rejected'))
       or (r.status='confirmed' and p_status in ('seated','cancelled','no_show'))
       or (r.status='seated' and p_status='completed')) then
    raise exception using errcode='P0001',message='INVALID_TRANSITION';
  end if;
  if p_status in ('seated','no_show','completed') and r.starts_at>clock_timestamp() then
    raise exception using errcode='P0001',message='TOO_EARLY_FOR_STATUS';
  end if;
  perform set_config('cafe.actor_id',coalesce(p_actor::text,''),true);
  perform set_config('cafe.actor_kind',case when role_name in ('staff','admin') then role_name when p_actor is not null and r.user_id=p_actor then 'customer' else 'guest' end,true);
  update public.reservations set status=p_status,version=version+1,updated_at=clock_timestamp() where id=p_id returning * into r;
  return to_jsonb(r);
end $$;

create function cafe_private.set_role(p_actor uuid,p_target uuid,p_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(614021);
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception using errcode='P0001',message='FORBIDDEN'; end if;
  if p_role not in ('customer','staff','admin') then raise exception using errcode='P0001',message='INVALID_INPUT'; end if;
  if p_role<>'admin' and exists(select 1 from public.profiles where id=p_target and role='admin') and (select count(*) from public.profiles where role='admin')<=1 then raise exception using errcode='P0001',message='LAST_ADMIN'; end if;
  update public.profiles set role=p_role where id=p_target;
  if not found then raise exception using errcode='P0001',message='NOT_FOUND'; end if;
end $$;

create function cafe_private.consume_limit(p_key text,p_max integer,p_seconds integer) returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer; begin
  insert into cafe_private.request_limits as l(key,window_start,hits) values(p_key,clock_timestamp(),1)
  on conflict(key) do update set hits=case when l.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then 1 else l.hits+1 end,
    window_start=case when l.window_start<clock_timestamp()-make_interval(secs=>p_seconds) then clock_timestamp() else l.window_start end returning hits into n;
  return n<=p_max;
end $$;

-- Explicit grants + RLS: Data API users cannot mutate booking tables or call private functions.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_audit enable row level security;
revoke all on public.profiles,public.categories,public.menu_items,public.reservations,public.reservation_audit from anon,authenticated,service_role;
grant select on public.categories,public.menu_items to anon,authenticated,service_role;
grant select on public.profiles,public.reservations,public.reservation_audit to authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy published_menu on public.menu_items for select to anon,authenticated using(published);
create policy published_category on public.categories for select to anon,authenticated using(exists(select 1 from public.menu_items m where m.category_id=categories.id and m.published));
create policy own_reservations on public.reservations for select to authenticated using(user_id=(select auth.uid()));
create policy own_audit on public.reservation_audit for select to authenticated using(exists(select 1 from public.reservations r where r.id=reservation_id and r.user_id=(select auth.uid())));
grant select on public.profiles,public.categories,public.menu_items,public.reservations,public.reservation_audit to cafe_api;
grant insert,update on public.menu_items,public.categories to cafe_api;
create policy server_profile on public.profiles to cafe_api using(true);
create policy server_category on public.categories to cafe_api using(true) with check(true);
create policy server_menu on public.menu_items to cafe_api using(true) with check(true);
create policy server_reservation on public.reservations for select to cafe_api using(true);
create policy server_audit on public.reservation_audit for select to cafe_api using(true);
grant select on cafe_private.settings,cafe_private.guest_access to cafe_api;
grant select,update on cafe_private.notification_outbox to cafe_api;
grant delete on cafe_private.request_limits to cafe_api;
revoke all on all functions in schema cafe_private from public,anon,authenticated,service_role;
grant execute on function cafe_private.create_booking(uuid,uuid,text,text,jsonb,text,text),cafe_private.change_booking(uuid,text,uuid,integer,text),cafe_private.peak_seats(timestamptz,timestamptz,uuid),cafe_private.consume_limit(text,integer,integer),cafe_private.set_role(uuid,uuid,text) to cafe_api;
