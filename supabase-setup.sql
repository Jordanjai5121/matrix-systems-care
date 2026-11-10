-- Matrix Tech + Matrix Innovation: Supabase setup. Run once in Supabase > SQL Editor.
-- Tables are prefixed tech_ and innovation_ so each division stays separate. Row Level Security is ON for all.
create extension if not exists pgcrypto;
create table if not exists admin_roles(user_id uuid primary key references auth.users on delete cascade, role text not null check (role in ('tech','innovation','owner')));
create or replace function is_admin(d text) returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from admin_roles where user_id=auth.uid() and role in (d,'owner')) $$;

create table if not exists tech_enquiries(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),name text,phone text,email text,category text,device text,preferred_date text,problem text,location text,status text default 'new',notes text);
create table if not exists tech_jobs(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),customer text,phone text,service text,status text default 'new',amount numeric,notes text);

create table if not exists innovation_products(id text primary key,name text not null,category text,description text,image_key text,image_url text,price numeric,min_qty int default 1,status text default 'made_to_order' check (status in ('available','made_to_order','out_of_stock','coming_soon')),customizable boolean default false,active boolean default true,sort int default 100);
create table if not exists innovation_customers(id uuid primary key references auth.users on delete cascade,name text,phone text,email text,created_at timestamptz default now());
create table if not exists innovation_orders(id uuid primary key default gen_random_uuid(),order_no text unique,created_at timestamptz default now(),customer_id uuid references auth.users,customer_name text,phone text,address text,status text default 'new',payment_status text default 'unpaid',delivery_charge numeric default 0,total numeric,notes text);
create table if not exists innovation_order_items(id uuid primary key default gen_random_uuid(),order_id uuid references innovation_orders on delete cascade,product_id text,product_name text,qty int default 1,unit_price numeric,customization jsonb,customization_status text default 'pending');
create table if not exists innovation_enquiries(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),product_id text,name text,phone text,message text,status text default 'new');

create or replace function innovation_new_customer() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into innovation_customers(id,name,phone,email) values(new.id,coalesce(new.raw_user_meta_data->>'name',''),coalesce(new.raw_user_meta_data->>'phone',''),new.email) on conflict do nothing; return new; end $$;
drop trigger if exists innovation_on_signup on auth.users;
create trigger innovation_on_signup after insert on auth.users for each row execute function innovation_new_customer();

alter table admin_roles enable row level security; alter table tech_enquiries enable row level security; alter table tech_jobs enable row level security;
alter table innovation_products enable row level security; alter table innovation_customers enable row level security; alter table innovation_orders enable row level security;
alter table innovation_order_items enable row level security; alter table innovation_enquiries enable row level security;

create policy "own role" on admin_roles for select using (user_id=auth.uid());
create policy "visitors send tech enquiry" on tech_enquiries for insert to anon,authenticated with check (status='new');
create policy "tech admin enquiries" on tech_enquiries for all using (is_admin('tech')) with check (is_admin('tech'));
create policy "tech admin jobs" on tech_jobs for all using (is_admin('tech')) with check (is_admin('tech'));

create policy "public sees active products" on innovation_products for select using (active or is_admin('innovation'));
create policy "innovation admin products" on innovation_products for all using (is_admin('innovation')) with check (is_admin('innovation'));
create policy "own customer record" on innovation_customers for select using (id=auth.uid() or is_admin('innovation'));
create policy "update own customer record" on innovation_customers for update using (id=auth.uid());
create policy "customer places order" on innovation_orders for insert to authenticated with check (customer_id=auth.uid() and status='new' and payment_status='unpaid');
create policy "see own orders" on innovation_orders for select using (customer_id=auth.uid() or is_admin('innovation'));
create policy "innovation admin orders" on innovation_orders for update using (is_admin('innovation')) with check (is_admin('innovation'));
create policy "innovation admin delete orders" on innovation_orders for delete using (is_admin('innovation'));
create policy "customer adds own items" on innovation_order_items for insert to authenticated with check (exists(select 1 from innovation_orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy "see own items" on innovation_order_items for select using (is_admin('innovation') or exists(select 1 from innovation_orders o where o.id=order_id and o.customer_id=auth.uid()));
create policy "innovation admin items" on innovation_order_items for update using (is_admin('innovation')) with check (is_admin('innovation'));
create policy "visitors send innovation enquiry" on innovation_enquiries for insert to anon,authenticated with check (status='new');
create policy "innovation admin enquiries" on innovation_enquiries for all using (is_admin('innovation')) with check (is_admin('innovation'));

insert into innovation_products(id,name,category,description,image_key,price,min_qty,status,customizable,active,sort) values
('MI-001','Customised Resin Art Diary','Customized Resin Art Diaries','Handmade resin diary with your name and message, shown with a matching resin bookmark.','diary',null,1,'made_to_order',true,true,1),
('MI-002','Customized Chocolate Wraps','Customized Chocolate Wraps','Wrappers with your name, photo or message for birthdays, anniversaries and celebrations.','choc',15,10,'made_to_order',true,true,2),
('MI-003','Resin Diya Tray','Resin Art & Decorative Gifts','Decorative resin lotus diya trays with gold leaf detail, shown in pastel shades for Diwali.','diya',null,1,'made_to_order',false,true,3),
('MI-004','Resin Wall Clock','Resin Art & Decorative Gifts','Ocean-wave resin clock with gold detailing.','clock',null,1,'made_to_order',false,true,4),
('MI-005','Resin Coasters','Resin Art & Decorative Gifts','Ocean-wave resin coasters.','coast',null,1,'made_to_order',false,true,5),
('MI-006','Resin Art Piece','Resin Art & Decorative Gifts','Decorative resin wave art on a stand.','art',null,1,'made_to_order',false,true,6),
('MI-007','Resin Alphabets','Resin Art & Decorative Gifts','Floral resin letters.','alpha',null,1,'made_to_order',false,true,7),
('MI-008','Resin Paper Weight','Resin Art & Decorative Gifts','Clear resin paper weight with a dried flower.','pw',null,1,'made_to_order',false,true,8),
('MI-009','Personalised Name Ruler','Personalized Kids’ Gifts','Resin art ruler with your child’s name and a glitter finish.','ruler',null,1,'made_to_order',true,true,9),
('MI-010','Glitter Resin Stationery','Personalized Kids’ Gifts','Glitter-finish resin piece for kids.','glit',null,1,'made_to_order',false,true,10),
('MI-011','Star Keychain','Personalized Kids’ Gifts','Star-shaped keychain, a small gift for kids.','star',null,1,'made_to_order',false,true,11),
('MI-012','Resin Keychains','Personalized Accessories','Resin keychains in heart, round and rectangle shapes, with photo options.','keys',null,1,'made_to_order',true,true,12),
('MI-013','Resin Bookmarks','Personalized Accessories','Floral resin bookmarks with tassels.','bmk',null,1,'made_to_order',false,true,13),
('MI-014','Resin Pens','Personalized Accessories','Resin-finish pens.','pens',null,1,'made_to_order',false,true,14),
('MI-015','Resin Jewellery','Personalized Accessories','Resin pendants and earrings.','jewel',null,1,'made_to_order',false,true,15),
('MI-016','Custom Photo Frame','Customized Photo & Decorative Products','Floral resin photo frame for your own photo.','frame',null,1,'made_to_order',true,true,16),
('MI-017','Name Boards','Customized Photo & Decorative Products','Wood-style name boards with floral resin decoration.','name',null,1,'made_to_order',true,true,17),
('MI-018','Personalised Photo Block','Customized Photo & Decorative Products','Clear resin photo block with floral decoration.','block',null,1,'made_to_order',true,true,18)
on conflict (id) do nothing;

-- AFTER you create admin users in Supabase > Authentication > Users, give each a role (replace the emails):
-- insert into admin_roles(user_id,role) select id,'tech' from auth.users where email='tech-admin@example.com';
-- insert into admin_roles(user_id,role) select id,'innovation' from auth.users where email='innovation-admin@example.com';
