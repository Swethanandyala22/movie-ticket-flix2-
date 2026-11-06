-- Movie Ticket Flix database schema for Supabase (PostgreSQL)
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
-- Demo setup only: the Node server uses the service-role key and must never expose it in frontend code.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text, -- Optional if you later build custom auth; prefer Supabase Auth instead.
  created_at timestamptz not null default now()
);

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  genre text,
  language text default 'English',
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  release_year integer,
  rating numeric(3,1),
  poster_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- City directory for the location selector. The theatre location field remains readable by the API.
create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  state text not null default 'India',
  created_at timestamptz not null default now()
);

create table if not exists public.theatres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.screens (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  screen_name text not null,
  created_at timestamptz not null default now(),
  unique (theatre_id, screen_name)
);

create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies(id) on delete cascade,
  theatre_id uuid not null references public.theatres(id) on delete cascade,
  screen_id uuid references public.screens(id) on delete set null,
  screen_name text not null default 'Screen 1',
  show_date date not null,
  show_time time not null,
  ticket_price numeric(10,2) not null check (ticket_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.seats (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.screens(id) on delete cascade,
  seat_number text not null,
  seat_type text not null default 'standard' check (seat_type in ('standard','premium')),
  created_at timestamptz not null default now(),
  unique (screen_id, seat_number)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_name text not null,
  customer_email text not null,
  show_id uuid not null references public.shows(id),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.booking_seats (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  seat_id uuid not null references public.seats(id),
  ticket_price numeric(10,2) not null check (ticket_price >= 0),
  created_at timestamptz not null default now(),
  unique (booking_id, seat_id)
);

create index if not exists shows_movie_date_idx on public.shows(movie_id, show_date, show_time);
create index if not exists bookings_reference_idx on public.bookings(reference);
create index if not exists booking_seats_seat_idx on public.booking_seats(seat_id);

-- Turn on RLS. Browser clients should not receive broad write access.
alter table public.cities enable row level security;
alter table public.users enable row level security;
alter table public.movies enable row level security;
alter table public.theatres enable row level security;
alter table public.screens enable row level security;
alter table public.shows enable row level security;
alter table public.seats enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_seats enable row level security;

-- Public SELECT policies are not needed for this app because reads go through the Node server.
-- The server uses the service-role key, which bypasses RLS. Protect that key carefully.

-- Return seats for a show and mark seats that are already booked for that same show.
create or replace function public.get_show_seats(p_show_id uuid)
returns table(id uuid, seat_number text, seat_type text, is_booked boolean)
language sql
security definer
set search_path = public
as $$
  select s.id, s.seat_number, s.seat_type,
    exists (
      select 1
      from public.booking_seats bs
      join public.bookings b on b.id = bs.booking_id
      where bs.seat_id = s.id and b.show_id = p_show_id and b.status = 'confirmed'
    ) as is_booked
  from public.shows sh
  join public.seats s on s.screen_id = sh.screen_id
  where sh.id = p_show_id
  order by s.seat_number;
$$;

-- Atomically validate and create booking; the unique advisory lock prevents simultaneous
-- duplicate bookings for the same show/seat combination.
create or replace function public.create_booking(
  p_show_id uuid,
  p_seat_ids uuid[],
  p_customer_name text,
  p_customer_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_show public.shows%rowtype;
  v_booking_id uuid;
  v_reference text;
  v_total numeric(10,2);
  v_count integer;
  v_seat_count integer;
  v_seat_id uuid;
begin
  if p_customer_name is null or length(trim(p_customer_name)) < 1 then
    raise exception 'Customer name is required';
  end if;
  if p_customer_email is null or position('@' in p_customer_email) < 2 then
    raise exception 'A valid customer email is required';
  end if;
  if p_seat_ids is null or cardinality(p_seat_ids) < 1 or cardinality(p_seat_ids) > 10 then
    raise exception 'Choose between 1 and 10 seats';
  end if;

  select * into v_show from public.shows where id = p_show_id and is_active = true;
  if not found then raise exception 'Show not found or inactive'; end if;

  -- Acquire a transaction-level advisory lock per show and each seat.
  for v_seat_id in select distinct unnest(p_seat_ids) order by 1 loop
    perform pg_advisory_xact_lock(hashtext(p_show_id::text || ':' || v_seat_id::text));
  end loop;

  select count(distinct s.id), coalesce(sum(v_show.ticket_price), 0)
    into v_seat_count, v_total
  from public.seats s
  where s.id = any(p_seat_ids)
    and s.screen_id = v_show.screen_id;

  if v_seat_count <> cardinality(p_seat_ids) then
    raise exception 'One or more seats do not belong to this show screen';
  end if;

  select count(*) into v_count
  from public.booking_seats bs
  join public.bookings b on b.id = bs.booking_id
  where bs.seat_id = any(p_seat_ids)
    and b.show_id = p_show_id
    and b.status = 'confirmed';

  if v_count > 0 then raise exception 'One or more selected seats are already booked'; end if;

  v_total := v_show.ticket_price * cardinality(p_seat_ids);
  v_reference := 'FLIX-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 10));

  insert into public.bookings(reference, customer_name, customer_email, show_id, total_amount)
  values (v_reference, trim(p_customer_name), lower(trim(p_customer_email)), p_show_id, v_total)
  returning id into v_booking_id;

  insert into public.booking_seats(booking_id, seat_id, ticket_price)
  select v_booking_id, s.id, v_show.ticket_price
  from public.seats s
  where s.id = any(p_seat_ids);

  return jsonb_build_object(
    'id', v_booking_id,
    'reference', v_reference,
    'total_amount', v_total,
    'status', 'confirmed'
  );
end;
$$;
