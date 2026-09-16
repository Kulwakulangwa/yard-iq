-- =============================================================
-- yard-iq base schema
-- Reconstructed from src/lib/modules.ts, workflow routes and
-- the finance upgrade migration. Run BEFORE 0000_fleet_finance_upgrade.sql
-- =============================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- 1. Audit trigger function (called by every table's trigger)
-- ---------------------------------------------------------------
create or replace function public.set_audit_columns()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if new.updated_by is null then new.updated_by := auth.uid(); end if;
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

-- Helper macro-ish pattern used below:
--   create table ... with audit columns + rls + policies + trigger

-- ---------------------------------------------------------------
-- 2. profiles  (extends auth.users)
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.profiles enable row level security;
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles upsert" on public.profiles for insert to authenticated with check (true);
create policy "profiles update" on public.profiles for update to authenticated using (true) with check (true);
create trigger audit_cols_profiles before insert or update on public.profiles
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 3. user_roles
-- ---------------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (user_id, role)
);
create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
alter table public.user_roles enable row level security;
create policy "user_roles read"   on public.user_roles for select to authenticated using (true);
create policy "user_roles insert" on public.user_roles for insert to authenticated with check (true);
create policy "user_roles update" on public.user_roles for update to authenticated using (true) with check (true);
create policy "user_roles delete" on public.user_roles for delete to authenticated using (true);
create trigger audit_cols_user_roles before insert or update on public.user_roles
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 4. customers
-- ---------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  tax_id text,
  status text not null default 'Active',
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.customers enable row level security;
create policy "customers read"   on public.customers for select to authenticated using (true);
create policy "customers insert" on public.customers for insert to authenticated with check (true);
create policy "customers update" on public.customers for update to authenticated using (true) with check (true);
create policy "customers delete" on public.customers for delete to authenticated using (true);
create trigger audit_cols_customers before insert or update on public.customers
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 5. vehicles
-- ---------------------------------------------------------------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  vehicle_type text,
  is_trailer boolean not null default false,
  capacity numeric,
  odometer numeric default 0,
  status text not null default 'Available',
  yard_zone text,
  assigned_driver text,
  documents_expiry date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.vehicles enable row level security;
create policy "vehicles read"   on public.vehicles for select to authenticated using (true);
create policy "vehicles insert" on public.vehicles for insert to authenticated with check (true);
create policy "vehicles update" on public.vehicles for update to authenticated using (true) with check (true);
create policy "vehicles delete" on public.vehicles for delete to authenticated using (true);
create trigger audit_cols_vehicles before insert or update on public.vehicles
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 6. drivers
-- ---------------------------------------------------------------
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  driver_code text,
  phone text,
  licence_number text,
  licence_expiry date,
  assigned_vehicle text,
  monthly_salary_tzs numeric default 0,
  base_location text,
  status text not null default 'Available',
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.drivers enable row level security;
create policy "drivers read"   on public.drivers for select to authenticated using (true);
create policy "drivers insert" on public.drivers for insert to authenticated with check (true);
create policy "drivers update" on public.drivers for update to authenticated using (true) with check (true);
create policy "drivers delete" on public.drivers for delete to authenticated using (true);
create trigger audit_cols_drivers before insert or update on public.drivers
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 7. technicians
-- ---------------------------------------------------------------
create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  address text,
  speciality text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.technicians enable row level security;
create policy "technicians read"   on public.technicians for select to authenticated using (true);
create policy "technicians insert" on public.technicians for insert to authenticated with check (true);
create policy "technicians update" on public.technicians for update to authenticated using (true) with check (true);
create policy "technicians delete" on public.technicians for delete to authenticated using (true);
create trigger audit_cols_technicians before insert or update on public.technicians
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 8. trips
-- (includes contract_id / invoice_id / settled_at / audited_at that
--  the finance migration would otherwise re-add — kept here so the
--  ALTERs in that file are idempotent no-ops.)
-- ---------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  trip_number text not null unique,
  customer_id uuid references public.customers(id),
  origin text,
  destination text,
  planned_departure timestamptz,
  planned_arrival timestamptz,
  vehicle_id uuid references public.vehicles(id),
  trailer_id uuid references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  status text not null default 'Draft',
  planned_distance numeric,
  notes text,
  contract_id uuid,
  invoice_id uuid,
  settled_at timestamptz,
  audited_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.trips enable row level security;
create policy "trips read"   on public.trips for select to authenticated using (true);
create policy "trips insert" on public.trips for insert to authenticated with check (true);
create policy "trips update" on public.trips for update to authenticated using (true) with check (true);
create policy "trips delete" on public.trips for delete to authenticated using (true);
create trigger audit_cols_trips before insert or update on public.trips
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 9. loads
-- (verification.tsx writes actual_* fields — included here)
-- ---------------------------------------------------------------
create table if not exists public.loads (
  id uuid primary key default gen_random_uuid(),
  load_reference text not null unique,
  customer_id uuid references public.customers(id),
  trip_id uuid references public.trips(id),
  cargo_description text,
  cargo_category text,
  expected_quantity numeric,
  actual_quantity numeric,
  unit_of_measure text,
  expected_weight numeric,
  actual_weight numeric,
  origin text,
  destination text,
  planned_loading_date date,
  seal_number text,
  actual_seal_number text,
  loading_officer text,
  verification_officer text,
  variance_reason text,
  verified_at timestamptz,
  status text not null default 'Draft',
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.loads enable row level security;
create policy "loads read"   on public.loads for select to authenticated using (true);
create policy "loads insert" on public.loads for insert to authenticated with check (true);
create policy "loads update" on public.loads for update to authenticated using (true) with check (true);
create policy "loads delete" on public.loads for delete to authenticated using (true);
create trigger audit_cols_loads before insert or update on public.loads
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 10. fuel_allocations
-- ---------------------------------------------------------------
create table if not exists public.fuel_allocations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  trip_id uuid references public.trips(id),
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  fuel_type text default 'Diesel',
  planned_litres numeric,
  approved_litres numeric,
  fuel_cost numeric,
  currency text default 'TZS',
  supplier text,
  receipt_number text,
  status text not null default 'Draft',
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.fuel_allocations enable row level security;
create policy "fuel_allocations read"   on public.fuel_allocations for select to authenticated using (true);
create policy "fuel_allocations insert" on public.fuel_allocations for insert to authenticated with check (true);
create policy "fuel_allocations update" on public.fuel_allocations for update to authenticated using (true) with check (true);
create policy "fuel_allocations delete" on public.fuel_allocations for delete to authenticated using (true);
create trigger audit_cols_fuel_allocations before insert or update on public.fuel_allocations
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 11. work_orders
-- ---------------------------------------------------------------
create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_number text not null unique,
  vehicle_id uuid references public.vehicles(id),
  reported_defect text,
  priority text default 'Medium',
  technician text,
  planned_work text,
  status text not null default 'Open',
  odometer numeric,
  cost_estimate numeric,
  actual_cost numeric,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.work_orders enable row level security;
create policy "work_orders read"   on public.work_orders for select to authenticated using (true);
create policy "work_orders insert" on public.work_orders for insert to authenticated with check (true);
create policy "work_orders update" on public.work_orders for update to authenticated using (true) with check (true);
create policy "work_orders delete" on public.work_orders for delete to authenticated using (true);
create trigger audit_cols_work_orders before insert or update on public.work_orders
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 12. expenses
-- ---------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text not null unique,
  expense_date date default current_date,
  category text,
  amount numeric default 0,
  volume_liters numeric,
  currency text default 'TZS',
  supplier text,
  trip_id uuid references public.trips(id),
  vehicle_id uuid references public.vehicles(id),
  load_id uuid references public.loads(id),
  work_order_id uuid references public.work_orders(id),
  receipt_url text,
  status text not null default 'Draft',
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.expenses enable row level security;
create policy "expenses read"   on public.expenses for select to authenticated using (true);
create policy "expenses insert" on public.expenses for insert to authenticated with check (true);
create policy "expenses update" on public.expenses for update to authenticated using (true) with check (true);
create policy "expenses delete" on public.expenses for delete to authenticated using (true);
create trigger audit_cols_expenses before insert or update on public.expenses
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 13. invoices
-- ---------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid references public.customers(id),
  trip_id uuid references public.trips(id),
  load_id uuid references public.loads(id),
  amount numeric default 0,
  tax numeric default 0,
  currency text default 'TZS',
  due_date date,
  status text not null default 'Draft',
  attachment_url text,
  period_start date,
  period_end date,
  subtotal_tzs numeric default 0,
  vat_percent numeric default 18,
  vat_amount_tzs numeric default 0,
  total_amount_tzs numeric default 0,
  paid_amount_tzs numeric default 0,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.invoices enable row level security;
create policy "invoices read"   on public.invoices for select to authenticated using (true);
create policy "invoices insert" on public.invoices for insert to authenticated with check (true);
create policy "invoices update" on public.invoices for update to authenticated using (true) with check (true);
create policy "invoices delete" on public.invoices for delete to authenticated using (true);
create trigger audit_cols_invoices before insert or update on public.invoices
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 14. vehicle_inspections
-- ---------------------------------------------------------------
create table if not exists public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id),
  trip_id uuid references public.trips(id),
  inspection_type text default 'Gate',
  result text default 'Pass',
  odometer numeric,
  findings text,
  inspector text,
  inspected_at timestamptz default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.vehicle_inspections enable row level security;
create policy "vehicle_inspections read"   on public.vehicle_inspections for select to authenticated using (true);
create policy "vehicle_inspections insert" on public.vehicle_inspections for insert to authenticated with check (true);
create policy "vehicle_inspections update" on public.vehicle_inspections for update to authenticated using (true) with check (true);
create policy "vehicle_inspections delete" on public.vehicle_inspections for delete to authenticated using (true);
create trigger audit_cols_vehicle_inspections before insert or update on public.vehicle_inspections
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 15. tires
-- ---------------------------------------------------------------
create table if not exists public.tires (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique,
  brand text,
  size text,
  pattern text,
  status text not null default 'In Store',
  current_location text,
  vehicle_id uuid references public.vehicles(id),
  wheel_position text,
  installation_odometer numeric,
  condition text default 'Good',
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.tires enable row level security;
create policy "tires read"   on public.tires for select to authenticated using (true);
create policy "tires insert" on public.tires for insert to authenticated with check (true);
create policy "tires update" on public.tires for update to authenticated using (true) with check (true);
create policy "tires delete" on public.tires for delete to authenticated using (true);
create trigger audit_cols_tires before insert or update on public.tires
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 16. tire_movements
-- ---------------------------------------------------------------
create table if not exists public.tire_movements (
  id uuid primary key default gen_random_uuid(),
  tire_id uuid references public.tires(id),
  movement_type text,
  vehicle_id uuid references public.vehicles(id),
  wheel_position text,
  odometer numeric,
  reason text,
  condition text,
  technician text,
  verifier text,
  destination_location text,
  approved boolean not null default false,
  moved_at timestamptz default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.tire_movements enable row level security;
create policy "tire_movements read"   on public.tire_movements for select to authenticated using (true);
create policy "tire_movements insert" on public.tire_movements for insert to authenticated with check (true);
create policy "tire_movements update" on public.tire_movements for update to authenticated using (true) with check (true);
create policy "tire_movements delete" on public.tire_movements for delete to authenticated using (true);
create trigger audit_cols_tire_movements before insert or update on public.tire_movements
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 17. incidents
-- ---------------------------------------------------------------
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number text not null unique,
  incident_type text,
  severity text default 'Medium',
  occurred_at timestamptz,
  location text,
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  trip_id uuid references public.trips(id),
  load_id uuid references public.loads(id),
  tire_id uuid references public.tires(id),
  description text,
  people_involved text,
  financial_impact numeric default 0,
  status text not null default 'Open',
  investigator text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.incidents enable row level security;
create policy "incidents read"   on public.incidents for select to authenticated using (true);
create policy "incidents insert" on public.incidents for insert to authenticated with check (true);
create policy "incidents update" on public.incidents for update to authenticated using (true) with check (true);
create policy "incidents delete" on public.incidents for delete to authenticated using (true);
create trigger audit_cols_incidents before insert or update on public.incidents
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 18. police_cases
-- ---------------------------------------------------------------
create table if not exists public.police_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text,
  police_station text,
  officer_contact text,
  reported_on date,
  follow_up_notes text,
  case_status text default 'Open',
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.police_cases enable row level security;
create policy "police_cases read"   on public.police_cases for select to authenticated using (true);
create policy "police_cases insert" on public.police_cases for insert to authenticated with check (true);
create policy "police_cases update" on public.police_cases for update to authenticated using (true) with check (true);
create policy "police_cases delete" on public.police_cases for delete to authenticated using (true);
create trigger audit_cols_police_cases before insert or update on public.police_cases
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 19. yard_zones
-- ---------------------------------------------------------------
create table if not exists public.yard_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  capacity numeric,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.yard_zones enable row level security;
create policy "yard_zones read"   on public.yard_zones for select to authenticated using (true);
create policy "yard_zones insert" on public.yard_zones for insert to authenticated with check (true);
create policy "yard_zones update" on public.yard_zones for update to authenticated using (true) with check (true);
create policy "yard_zones delete" on public.yard_zones for delete to authenticated using (true);
create trigger audit_cols_yard_zones before insert or update on public.yard_zones
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 20. gate_entries  (written by gate.tsx)
-- ---------------------------------------------------------------
create table if not exists public.gate_entries (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in','out')),
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  trip_id uuid references public.trips(id),
  load_id uuid references public.loads(id),
  seal_number text,
  odometer numeric,
  decision text,
  notes text,
  inspector text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.gate_entries enable row level security;
create policy "gate_entries read"   on public.gate_entries for select to authenticated using (true);
create policy "gate_entries insert" on public.gate_entries for insert to authenticated with check (true);
create policy "gate_entries update" on public.gate_entries for update to authenticated using (true) with check (true);
create trigger audit_cols_gate_entries before insert or update on public.gate_entries
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 21. yard_movements  (zone changes)
-- ---------------------------------------------------------------
create table if not exists public.yard_movements (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id),
  from_zone text,
  to_zone text,
  movement_type text,
  notes text,
  moved_by uuid,
  moved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.yard_movements enable row level security;
create policy "yard_movements read"   on public.yard_movements for select to authenticated using (true);
create policy "yard_movements insert" on public.yard_movements for insert to authenticated with check (true);
create policy "yard_movements update" on public.yard_movements for update to authenticated using (true) with check (true);
create trigger audit_cols_yard_movements before insert or update on public.yard_movements
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 22. exceptions  (central queue — gate.tsx + verification.tsx)
-- ---------------------------------------------------------------
create table if not exists public.exceptions (
  id uuid primary key default gen_random_uuid(),
  exception_number text unique,
  exception_type text not null,
  severity text not null default 'Medium',
  status text not null default 'Open',
  description text,
  expected_value text,
  actual_value text,
  vehicle_id uuid references public.vehicles(id),
  trip_id uuid references public.trips(id),
  load_id uuid references public.loads(id),
  source text,
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.exceptions enable row level security;
create policy "exceptions read"   on public.exceptions for select to authenticated using (true);
create policy "exceptions insert" on public.exceptions for insert to authenticated with check (true);
create policy "exceptions update" on public.exceptions for update to authenticated using (true) with check (true);
create trigger audit_cols_exceptions before insert or update on public.exceptions
  for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------
-- 23. audit_logs
-- ---------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text,
  record_id text,
  action text,
  user_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create policy "audit_logs read"   on public.audit_logs for select to authenticated using (true);
create policy "audit_logs insert" on public.audit_logs for insert to authenticated with check (true);

-- ---------------------------------------------------------------
-- 24. bulk grants (Supabase default grants for authenticated/service_role)
-- ---------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables    in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant all on all routines  in schema public to authenticated, service_role;

alter default privileges in schema public
  grant all on tables to authenticated, service_role;
alter default privileges in schema public
  grant all on routines to authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to authenticated, service_role;

-- ---------------------------------------------------------------
-- 25. Trigger: keep profiles in sync with auth.users
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
