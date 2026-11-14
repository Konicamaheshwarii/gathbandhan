-- =====================================================================================
-- Shagun: database schema for Supabase (free tier).
--
-- Paste this whole file into Supabase → SQL Editor → New query, then click "Run".
-- It is safe to run again: tables are only created when missing, and functions,
-- triggers and policies are replaced.
--
-- Who can do what (enforced by Row Level Security, so the public "anon" key is safe):
--   • Anyone (guests, no login): read wedding pages; read totals and the blessing wall
--     through public_activity() (no phone numbers, no amounts when the couple hides
--     them); add a contribution or an RSVP (insert only, with sane limits).
--   • The couple (signed in by email, listed in wedding_owners): edit their wedding,
--     see every contribution and RSVP with phone numbers, verify contributions, add a
--     partner as co-owner, upload photos into their wedding's folder.
-- =====================================================================================

-- ---------- tables ----------

create table if not exists public.weddings (
  id            text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  slug          text not null unique
                check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$' and slug <> 'riya-weds-arjun'),
  partner1      text not null check (char_length(partner1) between 1 and 60),
  partner2      text not null check (char_length(partner2) between 1 and 60),
  wedding_date  date not null,
  venue         text not null default '' check (char_length(venue) <= 120),
  city          text not null default '' check (char_length(city) <= 60),
  upi_id        text not null check (upi_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,255}@[a-zA-Z][a-zA-Z0-9.]{1,63}$'),
  payee_name    text not null check (char_length(payee_name) between 1 and 60),
  show_amounts  boolean not null default false,
  -- cover, story, goals (+ updates), events, families, gallery, milestones
  details       jsonb not null default '{}'::jsonb
                check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 200000),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- bumped whenever a guest gives shagun, so guests' pages can refresh live
  activity_at   timestamptz not null default now()
);

create table if not exists public.wedding_owners (
  wedding_id  text not null references public.weddings (id) on delete cascade,
  email       text not null check (email = lower(email) and char_length(email) <= 254
                                  and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  added_at    timestamptz not null default now(),
  primary key (wedding_id, email)
);
create index if not exists wedding_owners_email_idx on public.wedding_owners (email);

create table if not exists public.contributions (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.weddings (id) on delete cascade,
  goal_id     text not null check (char_length(goal_id) between 1 and 40),
  guest_name  text not null check (char_length(btrim(guest_name)) between 2 and 80),
  amount      integer not null check (amount between 1 and 100000),
  message     text not null default '' check (char_length(message) <= 280),
  phone       text check (phone is null or phone ~ '^91[6-9][0-9]{9}$'),
  side        text check (side is null or side in ('bride', 'groom')),
  status      text not null default 'guest-confirmed' check (status in ('guest-confirmed', 'verified')),
  thanked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists contributions_wedding_idx on public.contributions (wedding_id, created_at desc);

create table if not exists public.rsvps (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.weddings (id) on delete cascade,
  guest_name  text not null check (char_length(btrim(guest_name)) between 2 and 80),
  phone       text check (phone is null or phone ~ '^91[6-9][0-9]{9}$'),
  side        text check (side is null or side in ('bride', 'groom')),
  event_ids   text[] not null default '{}' check (cardinality(event_ids) <= 8),
  party_size  integer not null default 1 check (party_size between 1 and 20),
  note        text not null default '' check (char_length(note) <= 280),
  created_at  timestamptz not null default now()
);
create index if not exists rsvps_wedding_idx on public.rsvps (wedding_id, created_at desc);

-- ---------- helper functions ----------

-- True when the signed-in user's (verified) email is listed as an owner of the wedding.
create or replace function public.is_wedding_owner(p_wedding_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.wedding_owners o
    where o.wedding_id = p_wedding_id
      and o.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- The public side of a wedding's shagun: totals per goal and the blessing wall.
-- Never returns phone numbers; returns amounts only when the couple shows them.
create or replace function public.public_activity(p_wedding_id text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with w as (select id, show_amounts from public.weddings where id = p_wedding_id),
       c as (select * from public.contributions where wedding_id = p_wedding_id)
  select case when not exists (select 1 from w) then null else jsonb_build_object(
    'raised', coalesce((select sum(amount) from c), 0),
    'contributors', (select count(distinct lower(btrim(guest_name))) from c),
    'goals', coalesce((
      select jsonb_object_agg(goal_id, jsonb_build_object('raised', raised, 'count', n))
      from (select goal_id, sum(amount) as raised, count(*) as n from c group by goal_id) g
    ), '{}'::jsonb),
    'wall', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', m.id,
               'goalId', m.goal_id,
               'guestName', m.guest_name,
               'message', m.message,
               'side', m.side,
               'amount', case when (select show_amounts from w) then m.amount end,
               'createdAt', (extract(epoch from m.created_at) * 1000)::bigint
             )) order by m.created_at desc)
      from (select * from c where btrim(message) <> '' order by created_at desc limit 200) m
    ), '[]'::jsonb)
  ) end;
$$;

-- ---------- triggers ----------

-- Whoever creates a wedding becomes its first owner.
create or replace function public.add_creator_as_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> '' then
    insert into public.wedding_owners (wedding_id, email)
    values (new.id, lower(auth.jwt() ->> 'email'))
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists weddings_add_owner on public.weddings;
create trigger weddings_add_owner after insert on public.weddings
  for each row execute function public.add_creator_as_owner();

create or replace function public.touch_wedding()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists weddings_touch on public.weddings;
create trigger weddings_touch before update of slug, partner1, partner2, wedding_date, venue, city,
  upi_id, payee_name, show_amounts, details on public.weddings
  for each row execute function public.touch_wedding();

-- A wedding always keeps at least one owner (deleting the wedding itself still works).
create or replace function public.keep_last_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.weddings where id = old.wedding_id)
     and (select count(*) from public.wedding_owners where wedding_id = old.wedding_id) <= 1 then
    raise exception 'A wedding needs at least one owner.' using errcode = '23514';
  end if;
  return old;
end;
$$;
drop trigger if exists wedding_owners_keep_last on public.wedding_owners;
create trigger wedding_owners_keep_last before delete on public.wedding_owners
  for each row execute function public.keep_last_owner();

-- Guests cannot mark their own shagun verified, backdate it, or give to a goal that does not exist.
create or replace function public.guard_contribution()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.status := 'guest-confirmed';
  new.thanked_at := null;
  new.created_at := now();
  new.guest_name := btrim(new.guest_name);
  new.message := btrim(coalesce(new.message, ''));
  if not exists (
    select 1 from public.weddings w, jsonb_array_elements(coalesce(w.details -> 'goals', '[]'::jsonb)) g
    where w.id = new.wedding_id and g ->> 'id' = new.goal_id
  ) then
    raise exception 'This dream is not on the wedding page.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists contributions_guard on public.contributions;
create trigger contributions_guard before insert on public.contributions
  for each row execute function public.guard_contribution();

create or replace function public.guard_rsvp()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.created_at := now();
  new.guest_name := btrim(new.guest_name);
  new.note := btrim(coalesce(new.note, ''));
  if exists (
    select 1 from unnest(new.event_ids) as e(id)
    where e.id not in (
      select ev ->> 'id' from public.weddings w, jsonb_array_elements(coalesce(w.details -> 'events', '[]'::jsonb)) ev
      where w.id = new.wedding_id
    )
  ) then
    raise exception 'That function is not on the wedding page.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists rsvps_guard on public.rsvps;
create trigger rsvps_guard before insert on public.rsvps
  for each row execute function public.guard_rsvp();

-- New shagun bumps the wedding's activity_at, which guests receive over realtime.
create or replace function public.bump_wedding_activity()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.weddings set activity_at = now() where id = coalesce(new.wedding_id, old.wedding_id);
  return null;
end;
$$;
drop trigger if exists contributions_bump on public.contributions;
create trigger contributions_bump after insert or update or delete on public.contributions
  for each row execute function public.bump_wedding_activity();

-- ---------- privileges (column level) ----------

revoke all on public.weddings, public.wedding_owners, public.contributions, public.rsvps from anon, authenticated;

grant select (id, slug, partner1, partner2, wedding_date, venue, city, upi_id, payee_name, show_amounts,
              details, created_at, updated_at, activity_at)
  on public.weddings to anon, authenticated;
grant insert (id, slug, partner1, partner2, wedding_date, venue, city, upi_id, payee_name, show_amounts, details)
  on public.weddings to authenticated;
grant update (slug, partner1, partner2, wedding_date, venue, city, upi_id, payee_name, show_amounts, details)
  on public.weddings to authenticated;
grant delete on public.weddings to authenticated;

grant select, insert, delete on public.wedding_owners to authenticated;

grant insert (id, wedding_id, goal_id, guest_name, amount, message, phone, side) on public.contributions to anon, authenticated;
grant select, delete on public.contributions to authenticated;
grant update (status, thanked_at) on public.contributions to authenticated;

grant insert (id, wedding_id, guest_name, phone, side, event_ids, party_size, note) on public.rsvps to anon, authenticated;
grant select, delete on public.rsvps to authenticated;

grant execute on function public.public_activity(text) to anon, authenticated;
grant execute on function public.is_wedding_owner(text) to anon, authenticated;

-- ---------- row level security ----------

alter table public.weddings enable row level security;
alter table public.wedding_owners enable row level security;
alter table public.contributions enable row level security;
alter table public.rsvps enable row level security;

drop policy if exists "wedding pages are public" on public.weddings;
create policy "wedding pages are public" on public.weddings
  for select to anon, authenticated using (true);
drop policy if exists "signed-in couples create weddings" on public.weddings;
create policy "signed-in couples create weddings" on public.weddings
  for insert to authenticated with check (auth.uid() is not null and created_by = auth.uid());
drop policy if exists "owners edit their wedding" on public.weddings;
create policy "owners edit their wedding" on public.weddings
  for update to authenticated using (public.is_wedding_owner(id)) with check (public.is_wedding_owner(id));
drop policy if exists "owners delete their wedding" on public.weddings;
create policy "owners delete their wedding" on public.weddings
  for delete to authenticated using (public.is_wedding_owner(id));

drop policy if exists "owners see co-owners" on public.wedding_owners;
create policy "owners see co-owners" on public.wedding_owners
  for select to authenticated using (public.is_wedding_owner(wedding_id));
drop policy if exists "owners add co-owners" on public.wedding_owners;
create policy "owners add co-owners" on public.wedding_owners
  for insert to authenticated with check (public.is_wedding_owner(wedding_id));
drop policy if exists "owners remove co-owners" on public.wedding_owners;
create policy "owners remove co-owners" on public.wedding_owners
  for delete to authenticated using (public.is_wedding_owner(wedding_id));

drop policy if exists "guests give shagun" on public.contributions;
create policy "guests give shagun" on public.contributions
  for insert to anon, authenticated
  with check (amount between 1 and 100000 and char_length(message) <= 280
              and exists (select 1 from public.weddings w where w.id = wedding_id));
drop policy if exists "owners see shagun" on public.contributions;
create policy "owners see shagun" on public.contributions
  for select to authenticated using (public.is_wedding_owner(wedding_id));
drop policy if exists "owners verify shagun" on public.contributions;
create policy "owners verify shagun" on public.contributions
  for update to authenticated using (public.is_wedding_owner(wedding_id)) with check (public.is_wedding_owner(wedding_id));
drop policy if exists "owners remove shagun" on public.contributions;
create policy "owners remove shagun" on public.contributions
  for delete to authenticated using (public.is_wedding_owner(wedding_id));

drop policy if exists "guests rsvp" on public.rsvps;
create policy "guests rsvp" on public.rsvps
  for insert to anon, authenticated
  with check (party_size between 1 and 20 and char_length(note) <= 280
              and exists (select 1 from public.weddings w where w.id = wedding_id));
drop policy if exists "owners see rsvps" on public.rsvps;
create policy "owners see rsvps" on public.rsvps
  for select to authenticated using (public.is_wedding_owner(wedding_id));
drop policy if exists "owners remove rsvps" on public.rsvps;
create policy "owners remove rsvps" on public.rsvps
  for delete to authenticated using (public.is_wedding_owner(wedding_id));

-- ---------- realtime (live blessing wall and dashboard) ----------

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['contributions', 'rsvps', 'weddings'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------- photo storage ----------

-- Public bucket: anyone can view photos by URL; only owners can add or remove them, and
-- only inside their wedding's folder ("<wedding id>/<file>"). 1 MB per photo at most.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wedding-photos', 'wedding-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shagun: owners upload photos" on storage.objects;
create policy "shagun: owners upload photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wedding-photos' and public.is_wedding_owner((storage.foldername(name))[1]));
drop policy if exists "shagun: owners replace photos" on storage.objects;
create policy "shagun: owners replace photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'wedding-photos' and public.is_wedding_owner((storage.foldername(name))[1]));
drop policy if exists "shagun: owners list photos" on storage.objects;
create policy "shagun: owners list photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'wedding-photos' and public.is_wedding_owner((storage.foldername(name))[1]));
drop policy if exists "shagun: owners delete photos" on storage.objects;
create policy "shagun: owners delete photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wedding-photos' and public.is_wedding_owner((storage.foldername(name))[1]));
