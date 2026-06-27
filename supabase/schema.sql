create extension if not exists "pgcrypto";

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  supplier_name text default '',
  purchase_price numeric not null default 0,
  selling_price numeric not null default 0,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code)
);

create table if not exists pharmacies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  address text default '',
  contact_person text default '',
  phone_number text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code)
);

create table if not exists delivery_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  date date not null,
  pharmacy_id uuid not null references pharmacies(id) on delete restrict,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code)
);

create table if not exists delivery_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references delivery_batches(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity_sent integer not null check (quantity_sent > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  date date not null,
  pharmacy_id uuid not null references pharmacies(id) on delete restrict,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code)
);

create table if not exists sales_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references sales_reports(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity_sold integer not null check (quantity_sold > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

with ranked as (
  select
    ctid,
    row_number() over (partition by owner_id, batch_id, product_id order by created_at, id) as row_number,
    sum(quantity_sent) over (partition by owner_id, batch_id, product_id) as total_quantity
  from delivery_items
)
update delivery_items item
set quantity_sent = ranked.total_quantity
from ranked
where item.ctid = ranked.ctid and ranked.row_number = 1;

with ranked as (
  select
    ctid,
    row_number() over (partition by owner_id, batch_id, product_id order by created_at, id) as row_number
  from delivery_items
)
delete from delivery_items item
using ranked
where item.ctid = ranked.ctid and ranked.row_number > 1;

with ranked as (
  select
    ctid,
    row_number() over (partition by owner_id, report_id, product_id order by created_at, id) as row_number,
    sum(quantity_sold) over (partition by owner_id, report_id, product_id) as total_quantity
  from sales_items
)
update sales_items item
set quantity_sold = ranked.total_quantity
from ranked
where item.ctid = ranked.ctid and ranked.row_number = 1;

with ranked as (
  select
    ctid,
    row_number() over (partition by owner_id, report_id, product_id order by created_at, id) as row_number
  from sales_items
)
delete from sales_items item
using ranked
where item.ctid = ranked.ctid and ranked.row_number > 1;

create unique index if not exists delivery_items_one_product_per_batch
on delivery_items(owner_id, batch_id, product_id);

create unique index if not exists sales_items_one_product_per_report
on sales_items(owner_id, report_id, product_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  date date not null,
  pharmacy_id uuid not null references pharmacies(id) on delete restrict,
  amount_paid numeric not null check (amount_paid > 0),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  date date not null,
  category text not null,
  amount numeric not null check (amount > 0),
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, code)
);

alter table delivery_batches drop constraint if exists delivery_batches_pharmacy_id_fkey;
alter table delivery_batches
  add constraint delivery_batches_pharmacy_id_fkey
  foreign key (pharmacy_id) references pharmacies(id) on delete restrict;

alter table delivery_items drop constraint if exists delivery_items_product_id_fkey;
alter table delivery_items
  add constraint delivery_items_product_id_fkey
  foreign key (product_id) references products(id) on delete restrict;

alter table sales_reports drop constraint if exists sales_reports_pharmacy_id_fkey;
alter table sales_reports
  add constraint sales_reports_pharmacy_id_fkey
  foreign key (pharmacy_id) references pharmacies(id) on delete restrict;

alter table sales_items drop constraint if exists sales_items_product_id_fkey;
alter table sales_items
  add constraint sales_items_product_id_fkey
  foreign key (product_id) references products(id) on delete restrict;

alter table payments drop constraint if exists payments_pharmacy_id_fkey;
alter table payments
  add constraint payments_pharmacy_id_fkey
  foreign key (pharmacy_id) references pharmacies(id) on delete restrict;

alter table products enable row level security;
alter table pharmacies enable row level security;
alter table delivery_batches enable row level security;
alter table delivery_items enable row level security;
alter table sales_reports enable row level security;
alter table sales_items enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;

drop policy if exists "own products" on products;
drop policy if exists "own pharmacies" on pharmacies;
drop policy if exists "own delivery batches" on delivery_batches;
drop policy if exists "own delivery items" on delivery_items;
drop policy if exists "own sales reports" on sales_reports;
drop policy if exists "own sales items" on sales_items;
drop policy if exists "own payments" on payments;
drop policy if exists "own expenses" on expenses;

create policy "own products" on products for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own pharmacies" on pharmacies for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own delivery batches" on delivery_batches for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own delivery items" on delivery_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own sales reports" on sales_reports for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own sales items" on sales_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own payments" on payments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own expenses" on expenses for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
