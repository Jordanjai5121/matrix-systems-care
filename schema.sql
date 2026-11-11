-- Matrix System Care: Tech + Innovation tables
-- Run once in Supabase Dashboard > SQL Editor.

-- 1. Admin access -----------------------------------------------------------
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email'))
$$;

drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select to authenticated using (public.is_admin());

-- 2. Contact settings (shared by both pages, keys start with tech_ / innovation_)
create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  hint text,
  updated_at timestamptz default now()
);

insert into public.site_settings (key, value, hint) values
  ('tech_whatsapp',        '917639814304', 'Digits only with country code, no + or spaces'),
  ('tech_phone',           '917639814304', 'Digits only with country code. Used for the Call button'),
  ('tech_email',           'matrixsystem19@gmail.com', 'Shown on the Tech page'),
  ('innovation_whatsapp',  '918056359983', 'Digits only with country code'),
  ('innovation_phone',     '918056359983', 'Digits only with country code'),
  ('innovation_email',     'matrixsystemcare26@gmail.com', 'Shown on the Innovation page'),
  ('innovation_instagram', 'premraj359', 'Instagram username without @')
on conflict (key) do update set value = excluded.value, hint = excluded.hint;

-- 3. Tech tables ------------------------------------------------------------
create table if not exists public.tech_enquiries (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  name text, mobile text, email text, category text, device_type text,
  preferred_date text, problem text, location text,
  raw jsonb,
  status text not null default 'new',
  notes text,
  constraint tech_enq_size check (length(coalesce(raw::text, '')) < 8000)
);

create table if not exists public.tech_amc_plans (
  id bigint generated always as identity primary key,
  name text not null, price numeric, period text default 'year',
  features text, sort int default 0, active boolean default true
);

create table if not exists public.tech_products (
  id bigint generated always as identity primary key,
  name text not null, price numeric, description text,
  sort int default 0, active boolean default true
);

-- 4. Innovation tables ------------------------------------------------------
create table if not exists public.innovation_products (
  id bigint generated always as identity primary key,
  name text not null, category text, price numeric, description text,
  image_url text, sort int default 0, active boolean default true
);

create table if not exists public.innovation_offers (
  id bigint generated always as identity primary key,
  title text not null, image_url text, sort int default 0, active boolean default true
);

create table if not exists public.innovation_orders (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  customer_name text, mobile text, items text, message text, total numeric,
  raw jsonb,
  status text not null default 'new',
  notes text,
  constraint inn_ord_size check (length(coalesce(raw::text, '')) < 8000)
);

-- 5. Row level security -----------------------------------------------------
do $$
declare t text;
begin
  -- public read, admin write
  foreach t in array array['site_settings','tech_amc_plans','tech_products','innovation_products','innovation_offers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
  -- public form inserts, admin read/update/delete
  foreach t in array array['tech_enquiries','innovation_orders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (status = ''new'')', t || '_insert', t);
  end loop;
end $$;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);

drop policy if exists tech_amc_plans_read on public.tech_amc_plans;
create policy tech_amc_plans_read on public.tech_amc_plans for select to anon, authenticated using (active);
drop policy if exists tech_products_read on public.tech_products;
create policy tech_products_read on public.tech_products for select to anon, authenticated using (active);
drop policy if exists innovation_products_read on public.innovation_products;
create policy innovation_products_read on public.innovation_products for select to anon, authenticated using (active);
drop policy if exists innovation_offers_read on public.innovation_offers;
create policy innovation_offers_read on public.innovation_offers for select to anon, authenticated using (active);

-- 6. Make yourself admin ----------------------------------------------------
-- a) Dashboard > Authentication > Users > Add user (email + password).
-- b) Then run, with that same email in lowercase:
-- insert into public.admins (email) values ('your-admin-email@example.com');
