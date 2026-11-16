-- =====================================================================================
-- Gathbandhan: database schema for Supabase (free tier).
--
-- Every table, function and bucket is prefixed "shagun_" (from the app's original name,
-- Shagun) so this project can share one Supabase project with other apps without name clashes.
--
-- Paste this whole file into Supabase → SQL Editor → New query, then click "Run".
-- It is safe to run again: tables are only created when missing, and functions,
-- triggers and policies are replaced.
--
-- Who can do what (enforced by Row Level Security, so the public "anon" key is safe):
--   • Anyone (guests, no login): read wedding pages; read totals and the blessing wall
--     through shagun_public_activity() (no phone numbers, no amounts when the couple hides
--     them); add a contribution or an RSVP (insert only, with sane limits).
--   • A guest holding a personal invite link (a secret token): read only their own name
--     and greeting, and mark their invite opened / RSVP'd / gave shagun (shagun_guest_invite(),
--     shagun_guest_mark()). They can never list other guests.
--   • The couple (signed in by email, listed in wedding_owners): edit their wedding and
--     invite design, see every contribution, RSVP and guest with phone numbers, verify
--     contributions, add a partner as co-owner, upload photos into their wedding's folder.
--     They can read their Razorpay payout status but never write it.
--   • Razorpay payments (optional): only the Edge Functions in supabase/functions, which use
--     the service-role key, create Razorpay contributions and mark them "paid", after checking
--     Razorpay's signature. Guests and couples can never set "paid" themselves.
-- =====================================================================================

-- ---------- tables ----------

create table if not exists public.shagun_weddings (
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

create table if not exists public.shagun_wedding_owners (
  wedding_id  text not null references public.shagun_weddings (id) on delete cascade,
  email       text not null check (email = lower(email) and char_length(email) <= 254
                                  and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  added_at    timestamptz not null default now(),
  primary key (wedding_id, email)
);
create index if not exists shagun_wedding_owners_email_idx on public.shagun_wedding_owners (email);

create table if not exists public.shagun_contributions (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.shagun_weddings (id) on delete cascade,
  goal_id     text not null check (char_length(goal_id) between 1 and 40),
  guest_name  text not null check (char_length(btrim(guest_name)) between 2 and 80),
  amount      integer not null check (amount between 1 and 100000),
  message     text not null default '' check (char_length(message) <= 280),
  phone       text check (phone is null or phone ~ '^91[6-9][0-9]{9}$'),
  side        text check (side is null or side in ('bride', 'groom')),
  status      text not null default 'guest-confirmed',
  thanked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists shagun_contributions_wedding_idx on public.shagun_contributions (wedding_id, created_at desc);

create table if not exists public.shagun_rsvps (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.shagun_weddings (id) on delete cascade,
  guest_name  text not null check (char_length(btrim(guest_name)) between 2 and 80),
  phone       text check (phone is null or phone ~ '^91[6-9][0-9]{9}$'),
  side        text check (side is null or side in ('bride', 'groom')),
  event_ids   text[] not null default '{}' check (cardinality(event_ids) <= 8),
  party_size  integer not null default 1 check (party_size between 1 and 20),
  note        text not null default '' check (char_length(note) <= 280),
  created_at  timestamptz not null default now()
);
create index if not exists shagun_rsvps_wedding_idx on public.shagun_rsvps (wedding_id, created_at desc);

-- The couple's guest list for e-invites. Private: only owners can read it.
create table if not exists public.shagun_guests (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null references public.shagun_weddings (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  greeting    text check (greeting is null or char_length(greeting) <= 80),
  phone       text check (phone is null or phone ~ '^91[6-9][0-9]{9}$'),
  side        text check (side is null or side in ('bride', 'groom')),
  group_name  text check (group_name is null or char_length(group_name) <= 60),
  token       text not null unique check (token ~ '^[A-Za-z0-9]{8,24}$'),
  sent_at     timestamptz,
  opened_at   timestamptz,
  rsvp_at     timestamptz,
  gave_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists shagun_guests_wedding_idx on public.shagun_guests (wedding_id, created_at);

-- ---------- Razorpay payments (optional; added later, so existing projects are upgraded) ----------

-- How guests pay: straight to the couple's UPI ID (default), or through Razorpay Checkout.
-- razorpay_active mirrors the payout account status and is written only by the database itself.
alter table public.shagun_weddings add column if not exists payment_mode text not null default 'upi_direct';
alter table public.shagun_weddings add column if not exists fee_bearer text not null default 'couple';
alter table public.shagun_weddings add column if not exists razorpay_active boolean not null default false;
alter table public.shagun_weddings drop constraint if exists shagun_weddings_payment_mode_check;
alter table public.shagun_weddings add constraint shagun_weddings_payment_mode_check check (payment_mode in ('upi_direct', 'razorpay'));
alter table public.shagun_weddings drop constraint if exists shagun_weddings_fee_bearer_check;
alter table public.shagun_weddings add constraint shagun_weddings_fee_bearer_check check (fee_bearer in ('couple', 'guest'));

-- Contributions: direct UPI rows are 'guest-confirmed' / 'verified' (the couple checks the bank);
-- Razorpay rows go 'pending' -> 'paid' (or 'failed') and only the Edge Functions change them.
alter table public.shagun_contributions add column if not exists provider text not null default 'upi_direct';
alter table public.shagun_contributions add column if not exists razorpay_order_id text;
alter table public.shagun_contributions add column if not exists razorpay_payment_id text;
-- What the guest was charged (shagun + any convenience fee) and the fees, in rupees.
alter table public.shagun_contributions add column if not exists charged_amount numeric(10, 2);
alter table public.shagun_contributions add column if not exists guest_fee numeric(10, 2) not null default 0;
alter table public.shagun_contributions add column if not exists fee_amount numeric(10, 2) not null default 0;
alter table public.shagun_contributions add column if not exists paid_at timestamptz;
alter table public.shagun_contributions add column if not exists failure_reason text;
alter table public.shagun_contributions drop constraint if exists shagun_contributions_status_check;
alter table public.shagun_contributions add constraint shagun_contributions_status_check
  check (status in ('guest-confirmed', 'verified', 'pending', 'paid', 'failed'));
alter table public.shagun_contributions drop constraint if exists shagun_contributions_provider_check;
alter table public.shagun_contributions add constraint shagun_contributions_provider_check
  check (provider in ('upi_direct', 'razorpay')
         and (provider = 'razorpay' or status in ('guest-confirmed', 'verified'))
         and (provider = 'upi_direct' or (status in ('pending', 'paid', 'failed') and razorpay_order_id is not null)));
alter table public.shagun_contributions drop constraint if exists shagun_contributions_payment_ids_check;
alter table public.shagun_contributions add constraint shagun_contributions_payment_ids_check
  check ((razorpay_order_id is null or razorpay_order_id ~ '^order_[A-Za-z0-9]{6,40}$')
         and (razorpay_payment_id is null or razorpay_payment_id ~ '^pay_[A-Za-z0-9]{6,40}$')
         and (failure_reason is null or char_length(failure_reason) <= 200)
         and guest_fee >= 0 and fee_amount >= 0);
create unique index if not exists shagun_contributions_order_idx on public.shagun_contributions (razorpay_order_id) where razorpay_order_id is not null;
create unique index if not exists shagun_contributions_payment_idx on public.shagun_contributions (razorpay_payment_id) where razorpay_payment_id is not null;

-- The couple's Razorpay Route linked account (where their shagun settles). Private: owners can
-- read it, only the Edge Functions (service role) write it. Bank account and PAN are sent to
-- Razorpay and never stored here, only their last four characters (the checks enforce it).
create table if not exists public.shagun_payout_accounts (
  wedding_id           text primary key references public.shagun_weddings (id) on delete cascade,
  razorpay_account_id  text unique check (razorpay_account_id is null or razorpay_account_id ~ '^acc_[A-Za-z0-9]{6,40}$'),
  stakeholder_id       text check (stakeholder_id is null or stakeholder_id ~ '^sth_[A-Za-z0-9]{6,40}$'),
  product_id           text check (product_id is null or product_id ~ '^acc_prd_[A-Za-z0-9]{6,40}$'),
  status               text not null default 'not_set_up'
                       check (status in ('not_set_up', 'under_review', 'active', 'needs_info')),
  status_detail        text check (status_detail is null or char_length(status_detail) <= 500),
  -- false only in Razorpay test mode when Route could not be set up: orders then carry no transfer
  route_enabled        boolean not null default true,
  legal_name           text check (legal_name is null or char_length(legal_name) <= 120),
  contact_email        text check (contact_email is null or char_length(contact_email) <= 254),
  contact_phone        text check (contact_phone is null or contact_phone ~ '^[6-9][0-9]{9}$'),
  bank_last4           text check (bank_last4 is null or bank_last4 ~ '^[0-9]{4}$'),
  ifsc                 text check (ifsc is null or ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  pan_last4            text check (pan_last4 is null or pan_last4 ~ '^[A-Z0-9]{4}$'),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------- helper functions ----------

-- True when the signed-in user's (verified) email is listed as an owner of the wedding.
create or replace function public.shagun_is_owner(p_wedding_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.shagun_wedding_owners o
    where o.wedding_id = p_wedding_id
      and o.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- The public side of a wedding's shagun: totals per goal and the blessing wall.
-- Never returns phone numbers; returns amounts only when the couple shows them.
create or replace function public.shagun_public_activity(p_wedding_id text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with w as (select id, show_amounts from public.shagun_weddings where id = p_wedding_id),
       -- Razorpay payments count once paid; pending and failed attempts never show.
       c as (select * from public.shagun_contributions
             where wedding_id = p_wedding_id and status not in ('pending', 'failed'))
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
               'paid', case when m.status = 'paid' then true end,
               'amount', case when (select show_amounts from w) then m.amount end,
               'createdAt', (extract(epoch from m.created_at) * 1000)::bigint
             )) order by m.created_at desc)
      from (select * from c where btrim(message) <> '' order by created_at desc limit 200) m
    ), '[]'::jsonb)
  ) end;
$$;

-- A personal invite link reveals only that guest's own name and greeting.
create or replace function public.shagun_guest_invite(p_wedding_id text, p_token text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('name', g.name, 'greeting', coalesce(nullif(btrim(g.greeting), ''), g.name))
  from public.shagun_guests g
  where g.wedding_id = p_wedding_id and g.token = p_token;
$$;

-- The guest's own link can tick off "opened", "rsvp" and "gave" (first time only), nothing else.
create or replace function public.shagun_guest_mark(p_wedding_id text, p_token text, p_mark text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_mark not in ('opened', 'rsvp', 'gave') then
    raise exception 'Unknown mark' using errcode = '22023';
  end if;
  update public.shagun_guests g set
    opened_at = coalesce(g.opened_at, now()),
    rsvp_at   = case when p_mark = 'rsvp' then coalesce(g.rsvp_at, now()) else g.rsvp_at end,
    gave_at   = case when p_mark = 'gave' then coalesce(g.gave_at, now()) else g.gave_at end
  where g.wedding_id = p_wedding_id and g.token = p_token;
end;
$$;

-- What the give page polls while a Razorpay payment is being confirmed: only the status of
-- that one order (the order id comes from the guest's own checkout).
create or replace function public.shagun_order_status(p_order_id text)
returns text
language sql stable security definer set search_path = public
as $$
  select c.status from public.shagun_contributions c
  where c.provider = 'razorpay' and c.razorpay_order_id = p_order_id;
$$;

-- ---------- triggers ----------

-- Whoever creates a wedding becomes its first owner.
create or replace function public.shagun_add_creator_as_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') <> '' then
    insert into public.shagun_wedding_owners (wedding_id, email)
    values (new.id, lower(auth.jwt() ->> 'email'))
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists shagun_weddings_add_owner on public.shagun_weddings;
create trigger shagun_weddings_add_owner after insert on public.shagun_weddings
  for each row execute function public.shagun_add_creator_as_owner();

create or replace function public.shagun_touch_wedding()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists shagun_weddings_touch on public.shagun_weddings;
create trigger shagun_weddings_touch before update of slug, partner1, partner2, wedding_date, venue, city,
  upi_id, payee_name, show_amounts, details, payment_mode, fee_bearer on public.shagun_weddings
  for each row execute function public.shagun_touch_wedding();

-- A wedding always keeps at least one owner (deleting the wedding itself still works).
create or replace function public.shagun_keep_last_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.shagun_weddings where id = old.wedding_id)
     and (select count(*) from public.shagun_wedding_owners where wedding_id = old.wedding_id) <= 1 then
    raise exception 'A wedding needs at least one owner.' using errcode = '23514';
  end if;
  return old;
end;
$$;
drop trigger if exists shagun_wedding_owners_keep_last on public.shagun_wedding_owners;
create trigger shagun_wedding_owners_keep_last before delete on public.shagun_wedding_owners
  for each row execute function public.shagun_keep_last_owner();

-- Guests cannot mark their own shagun verified or paid, backdate it, or give to a goal that does
-- not exist. Only the service role (the Razorpay Edge Functions) may create Razorpay rows.
create or replace function public.shagun_guard_contribution()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.status := 'guest-confirmed';
    new.provider := 'upi_direct';
    new.razorpay_order_id := null;
    new.razorpay_payment_id := null;
    new.charged_amount := null;
    new.guest_fee := 0;
    new.fee_amount := 0;
    new.paid_at := null;
    new.failure_reason := null;
  elsif new.provider = 'razorpay' and new.status <> 'pending' then
    raise exception 'Razorpay shagun starts as pending.' using errcode = '23514';
  end if;
  new.thanked_at := null;
  new.created_at := now();
  new.guest_name := btrim(new.guest_name);
  new.message := btrim(coalesce(new.message, ''));
  if not exists (
    select 1 from public.shagun_weddings w, jsonb_array_elements(coalesce(w.details -> 'goals', '[]'::jsonb)) g
    where w.id = new.wedding_id and g ->> 'id' = new.goal_id
  ) then
    raise exception 'This dream is not on the wedding page.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists shagun_contributions_guard on public.shagun_contributions;
create trigger shagun_contributions_guard before insert on public.shagun_contributions
  for each row execute function public.shagun_guard_contribution();

-- Couples may flip direct-UPI shagun between 'guest-confirmed' and 'verified' and tick "thanked".
-- Razorpay rows keep the status Razorpay gave them: nobody but the service role sets 'paid'.
create or replace function public.shagun_guard_contribution_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if old.provider = 'razorpay' then
    new.status := old.status;
  elsif new.status not in ('guest-confirmed', 'verified') then
    raise exception 'Only Razorpay can mark a payment as paid.' using errcode = '23514';
  end if;
  new.provider := old.provider;
  new.razorpay_order_id := old.razorpay_order_id;
  new.razorpay_payment_id := old.razorpay_payment_id;
  new.charged_amount := old.charged_amount;
  new.guest_fee := old.guest_fee;
  new.fee_amount := old.fee_amount;
  new.paid_at := old.paid_at;
  new.amount := old.amount;
  return new;
end;
$$;
drop trigger if exists shagun_contributions_guard_update on public.shagun_contributions;
create trigger shagun_contributions_guard_update before update on public.shagun_contributions
  for each row execute function public.shagun_guard_contribution_update();

-- The wedding's razorpay_active flag follows its payout account, so guests' pages know whether
-- Razorpay Checkout can be offered (they cannot read the payout table itself).
create or replace function public.shagun_sync_payout_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  update public.shagun_weddings set razorpay_active = (new.status = 'active') where id = new.wedding_id;
  return new;
end;
$$;
drop trigger if exists shagun_payout_accounts_sync on public.shagun_payout_accounts;
create trigger shagun_payout_accounts_sync before insert or update on public.shagun_payout_accounts
  for each row execute function public.shagun_sync_payout_status();

create or replace function public.shagun_guard_rsvp()
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
      select ev ->> 'id' from public.shagun_weddings w, jsonb_array_elements(coalesce(w.details -> 'events', '[]'::jsonb)) ev
      where w.id = new.wedding_id
    )
  ) then
    raise exception 'That function is not on the wedding page.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists shagun_rsvps_guard on public.shagun_rsvps;
create trigger shagun_rsvps_guard before insert on public.shagun_rsvps
  for each row execute function public.shagun_guard_rsvp();

-- New shagun bumps the wedding's activity_at, which guests receive over realtime.
create or replace function public.shagun_bump_activity()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.shagun_weddings set activity_at = now() where id = coalesce(new.wedding_id, old.wedding_id);
  return null;
end;
$$;
drop trigger if exists shagun_contributions_bump on public.shagun_contributions;
create trigger shagun_contributions_bump after insert or update or delete on public.shagun_contributions
  for each row execute function public.shagun_bump_activity();

-- ---------- privileges (column level) ----------

revoke all on public.shagun_weddings, public.shagun_wedding_owners, public.shagun_contributions, public.shagun_rsvps, public.shagun_guests,
  public.shagun_payout_accounts from anon, authenticated;

grant select (id, slug, partner1, partner2, wedding_date, venue, city, upi_id, payee_name, show_amounts,
              details, created_at, updated_at, activity_at, payment_mode, fee_bearer, razorpay_active)
  on public.shagun_weddings to anon, authenticated;
grant insert (id, slug, partner1, partner2, wedding_date, venue, city, upi_id, payee_name, show_amounts, details,
              payment_mode, fee_bearer)
  on public.shagun_weddings to authenticated;
grant update (slug, partner1, partner2, wedding_date, venue, city, upi_id, payee_name, show_amounts, details,
              payment_mode, fee_bearer)
  on public.shagun_weddings to authenticated;
grant delete on public.shagun_weddings to authenticated;

grant select, insert, delete on public.shagun_wedding_owners to authenticated;

grant insert (id, wedding_id, goal_id, guest_name, amount, message, phone, side) on public.shagun_contributions to anon, authenticated;
grant select, delete on public.shagun_contributions to authenticated;
grant update (status, thanked_at) on public.shagun_contributions to authenticated;

grant insert (id, wedding_id, guest_name, phone, side, event_ids, party_size, note) on public.shagun_rsvps to anon, authenticated;
grant select, delete on public.shagun_rsvps to authenticated;

grant select, insert, update, delete on public.shagun_guests to authenticated;

-- Payout accounts: the couple may read theirs; nobody but the service role writes.
grant select on public.shagun_payout_accounts to authenticated;

grant execute on function public.shagun_public_activity(text) to anon, authenticated;
grant execute on function public.shagun_guest_invite(text, text) to anon, authenticated;
grant execute on function public.shagun_guest_mark(text, text, text) to anon, authenticated;
grant execute on function public.shagun_is_owner(text) to anon, authenticated;
grant execute on function public.shagun_order_status(text) to anon, authenticated;

-- ---------- row level security ----------

alter table public.shagun_weddings enable row level security;
alter table public.shagun_wedding_owners enable row level security;
alter table public.shagun_contributions enable row level security;
alter table public.shagun_rsvps enable row level security;
alter table public.shagun_guests enable row level security;
alter table public.shagun_payout_accounts enable row level security;

drop policy if exists "wedding pages are public" on public.shagun_weddings;
create policy "wedding pages are public" on public.shagun_weddings
  for select to anon, authenticated using (true);
drop policy if exists "signed-in couples create weddings" on public.shagun_weddings;
create policy "signed-in couples create weddings" on public.shagun_weddings
  for insert to authenticated with check (auth.uid() is not null and created_by = auth.uid());
drop policy if exists "owners edit their wedding" on public.shagun_weddings;
create policy "owners edit their wedding" on public.shagun_weddings
  for update to authenticated using (public.shagun_is_owner(id)) with check (public.shagun_is_owner(id));
drop policy if exists "owners delete their wedding" on public.shagun_weddings;
create policy "owners delete their wedding" on public.shagun_weddings
  for delete to authenticated using (public.shagun_is_owner(id));

drop policy if exists "owners see co-owners" on public.shagun_wedding_owners;
create policy "owners see co-owners" on public.shagun_wedding_owners
  for select to authenticated using (public.shagun_is_owner(wedding_id));
drop policy if exists "owners add co-owners" on public.shagun_wedding_owners;
create policy "owners add co-owners" on public.shagun_wedding_owners
  for insert to authenticated with check (public.shagun_is_owner(wedding_id));
drop policy if exists "owners remove co-owners" on public.shagun_wedding_owners;
create policy "owners remove co-owners" on public.shagun_wedding_owners
  for delete to authenticated using (public.shagun_is_owner(wedding_id));

drop policy if exists "guests give shagun" on public.shagun_contributions;
create policy "guests give shagun" on public.shagun_contributions
  for insert to anon, authenticated
  with check (amount between 1 and 100000 and char_length(message) <= 280
              and exists (select 1 from public.shagun_weddings w where w.id = wedding_id));
drop policy if exists "owners see shagun" on public.shagun_contributions;
create policy "owners see shagun" on public.shagun_contributions
  for select to authenticated using (public.shagun_is_owner(wedding_id));
drop policy if exists "owners verify shagun" on public.shagun_contributions;
create policy "owners verify shagun" on public.shagun_contributions
  for update to authenticated using (public.shagun_is_owner(wedding_id)) with check (public.shagun_is_owner(wedding_id));
drop policy if exists "owners remove shagun" on public.shagun_contributions;
create policy "owners remove shagun" on public.shagun_contributions
  for delete to authenticated using (public.shagun_is_owner(wedding_id));

drop policy if exists "guests rsvp" on public.shagun_rsvps;
create policy "guests rsvp" on public.shagun_rsvps
  for insert to anon, authenticated
  with check (party_size between 1 and 20 and char_length(note) <= 280
              and exists (select 1 from public.shagun_weddings w where w.id = wedding_id));
drop policy if exists "owners see rsvps" on public.shagun_rsvps;
create policy "owners see rsvps" on public.shagun_rsvps
  for select to authenticated using (public.shagun_is_owner(wedding_id));
drop policy if exists "owners remove rsvps" on public.shagun_rsvps;
create policy "owners remove rsvps" on public.shagun_rsvps
  for delete to authenticated using (public.shagun_is_owner(wedding_id));

drop policy if exists "owners manage guests" on public.shagun_guests;
create policy "owners manage guests" on public.shagun_guests
  for all to authenticated using (public.shagun_is_owner(wedding_id)) with check (public.shagun_is_owner(wedding_id));

drop policy if exists "owners see their payout account" on public.shagun_payout_accounts;
create policy "owners see their payout account" on public.shagun_payout_accounts
  for select to authenticated using (public.shagun_is_owner(wedding_id));

-- ---------- realtime (live blessing wall and dashboard) ----------

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['shagun_contributions', 'shagun_rsvps', 'shagun_weddings', 'shagun_guests'] loop
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
values ('shagun-photos', 'shagun-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shagun: owners upload photos" on storage.objects;
create policy "shagun: owners upload photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shagun-photos' and public.shagun_is_owner((storage.foldername(name))[1]));
drop policy if exists "shagun: owners replace photos" on storage.objects;
create policy "shagun: owners replace photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'shagun-photos' and public.shagun_is_owner((storage.foldername(name))[1]));
drop policy if exists "shagun: owners list photos" on storage.objects;
create policy "shagun: owners list photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'shagun-photos' and public.shagun_is_owner((storage.foldername(name))[1]));
drop policy if exists "shagun: owners delete photos" on storage.objects;
create policy "shagun: owners delete photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shagun-photos' and public.shagun_is_owner((storage.foldername(name))[1]));

-- =====================================================================================
-- Account profiles (added later; safe to run again).
--
-- One row per signed-in person, keyed by their auth user id. Only that person can read or
-- change it; guests (anon) have no access at all. The avatar lives in the shagun-photos bucket
-- under "avatars/<user id>/", and only its owner can write that folder.
-- =====================================================================================

create table if not exists public.shagun_profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null default '' check (char_length(full_name) <= 80),
  display_name   text not null default '' check (char_length(display_name) <= 40),
  -- E.164, for example +919876543210
  phone          text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  city           text not null default '' check (char_length(city) <= 60),
  avatar_path    text check (avatar_path is null or avatar_path ~ '^avatars/[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$'),
  wedding_role   text check (wedding_role is null or wedding_role in ('bride', 'groom', 'family', 'planner', 'other')),
  language       text not null default 'en' check (language in ('en', 'hi', 'gu', 'hinglish')),
  -- reused when the person creates a wedding page
  upi_id         text check (upi_id is null or upi_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,255}@[a-zA-Z][a-zA-Z0-9.]{1,63}$'),
  payee_name     text check (payee_name is null or char_length(payee_name) between 1 and 60),
  -- stored now for a future email feature; nothing is emailed yet
  notify_shagun  boolean not null default true,
  notify_rsvp    boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- the avatar must sit in the person's own folder
  constraint shagun_profiles_avatar_owner check (avatar_path is null or split_part(avatar_path, '/', 2) = id::text)
);

-- Server time for created_at / updated_at, and the id can never change.
create or replace function public.shagun_touch_profile()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists shagun_profiles_touch on public.shagun_profiles;
create trigger shagun_profiles_touch before insert or update on public.shagun_profiles
  for each row execute function public.shagun_touch_profile();

-- Supabase grants every table to anon and authenticated by default: take that away first,
-- then give signed-in people only the columns they need. Anon gets nothing.
revoke all on public.shagun_profiles from anon, authenticated;
grant select (id, full_name, display_name, phone, city, avatar_path, wedding_role, language, upi_id, payee_name,
              notify_shagun, notify_rsvp, created_at, updated_at)
  on public.shagun_profiles to authenticated;
grant insert (id, full_name, display_name, phone, city, avatar_path, wedding_role, language, upi_id, payee_name,
              notify_shagun, notify_rsvp)
  on public.shagun_profiles to authenticated;
grant update (full_name, display_name, phone, city, avatar_path, wedding_role, language, upi_id, payee_name,
              notify_shagun, notify_rsvp)
  on public.shagun_profiles to authenticated;
grant delete on public.shagun_profiles to authenticated;

alter table public.shagun_profiles enable row level security;

drop policy if exists "people read their own profile" on public.shagun_profiles;
create policy "people read their own profile" on public.shagun_profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "people create their own profile" on public.shagun_profiles;
create policy "people create their own profile" on public.shagun_profiles
  for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "people edit their own profile" on public.shagun_profiles;
create policy "people edit their own profile" on public.shagun_profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists "people delete their own profile" on public.shagun_profiles;
create policy "people delete their own profile" on public.shagun_profiles
  for delete to authenticated using (id = (select auth.uid()));

-- "avatars" is a folder in the photo bucket, so no wedding may use it as its id (wedding owners
-- may write their wedding's folder). NOT VALID: checked for new and changed rows.
alter table public.shagun_weddings drop constraint if exists shagun_weddings_id_not_reserved;
alter table public.shagun_weddings add constraint shagun_weddings_id_not_reserved check (id <> 'avatars') not valid;

-- Avatars: "avatars/<user id>/<file>". Anyone can view them by URL (the bucket is public);
-- only the person can add, replace, list or remove files in their own folder.
drop policy if exists "shagun: people upload their avatar" on storage.objects;
create policy "shagun: people upload their avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shagun-photos' and (storage.foldername(name))[1] = 'avatars'
              and (storage.foldername(name))[2] = (select auth.uid())::text);
drop policy if exists "shagun: people replace their avatar" on storage.objects;
create policy "shagun: people replace their avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'shagun-photos' and (storage.foldername(name))[1] = 'avatars'
         and (storage.foldername(name))[2] = (select auth.uid())::text)
  with check (bucket_id = 'shagun-photos' and (storage.foldername(name))[1] = 'avatars'
              and (storage.foldername(name))[2] = (select auth.uid())::text);
drop policy if exists "shagun: people list their avatar" on storage.objects;
create policy "shagun: people list their avatar" on storage.objects
  for select to authenticated
  using (bucket_id = 'shagun-photos' and (storage.foldername(name))[1] = 'avatars'
         and (storage.foldername(name))[2] = (select auth.uid())::text);
drop policy if exists "shagun: people delete their avatar" on storage.objects;
create policy "shagun: people delete their avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shagun-photos' and (storage.foldername(name))[1] = 'avatars'
         and (storage.foldername(name))[2] = (select auth.uid())::text);
