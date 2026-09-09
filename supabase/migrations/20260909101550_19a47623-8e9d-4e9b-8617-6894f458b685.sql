
-- ROLES
create type public.app_role as enum (
  'admin','operations_manager','dispatcher','finance_officer','yard_supervisor',
  'gate_security','loading_officer','fuel_attendant','maintenance_manager',
  'technician','security_investigator','auditor'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "roles readable by authenticated" on public.user_roles for select to authenticated using (true);
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
grant insert, update, delete on public.user_roles to authenticated;

create or replace function public.set_audit_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    new.created_at := now(); new.updated_at := now();
    new.created_by := coalesce(new.created_by, auth.uid()); new.updated_by := auth.uid();
  else
    new.updated_at := now(); new.updated_by := auth.uid();
    new.created_at := old.created_at; new.created_by := old.created_by;
  end if;
  return new;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- OPERATIONAL TABLES
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, contact_person text, phone text, email text, address text,
  tax_id text, status text not null default 'Active', notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique, vehicle_type text, is_trailer boolean not null default false,
  capacity text, odometer numeric default 0, status text not null default 'Available',
  yard_zone text, assigned_driver text, documents_expiry date, notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null, driver_code text, phone text, licence_number text, licence_expiry date,
  assigned_vehicle text, status text not null default 'Available', notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  trip_number text not null unique,
  customer_id uuid references public.customers(id),
  origin text, destination text,
  planned_departure timestamptz, planned_arrival timestamptz,
  vehicle_id uuid references public.vehicles(id),
  trailer_id uuid references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  status text not null default 'Draft', planned_distance numeric, notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.loads (
  id uuid primary key default gen_random_uuid(),
  load_reference text not null unique,
  customer_id uuid references public.customers(id),
  trip_id uuid references public.trips(id),
  cargo_description text, cargo_category text,
  expected_quantity numeric, unit_of_measure text, expected_weight numeric,
  origin text, destination text, planned_loading_date date, seal_number text,
  status text not null default 'Draft', notes text,
  actual_quantity numeric, actual_weight numeric, actual_seal_number text,
  loading_start timestamptz, loading_end timestamptz,
  loading_officer text, verification_officer text, variance_reason text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.yard_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, description text, capacity integer, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.gate_entries (
  id uuid primary key default gen_random_uuid(),
  direction text not null default 'IN',
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  trip_id uuid references public.trips(id),
  event_time timestamptz not null default now(),
  odometer numeric, vehicle_condition text, yard_zone text,
  seal_verified boolean, fuel_verified boolean, inspection_verified boolean, maintenance_hold boolean,
  decision text default 'Cleared', officer text, notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.yard_movements (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id),
  from_zone text, to_zone text, moved_at timestamptz not null default now(),
  trip_id uuid references public.trips(id), reason text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id),
  trip_id uuid references public.trips(id),
  inspection_type text, result text not null default 'Pass', odometer numeric,
  findings text, inspector text, inspected_at timestamptz not null default now(),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.fuel_allocations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  trip_id uuid references public.trips(id),
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  fuel_type text, planned_litres numeric, approved_litres numeric,
  fuel_cost numeric, currency text default 'TZS', supplier text, receipt_number text,
  status text not null default 'Draft', notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.tires (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique, brand text, size text, pattern text,
  status text not null default 'In Store', current_location text,
  vehicle_id uuid references public.vehicles(id), wheel_position text,
  installation_odometer numeric, condition text, notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.tire_movements (
  id uuid primary key default gen_random_uuid(),
  tire_id uuid references public.tires(id),
  movement_type text not null,
  vehicle_id uuid references public.vehicles(id),
  wheel_position text, odometer numeric, reason text, condition text,
  technician text, verifier text, destination_location text,
  approved boolean not null default false,
  moved_at timestamptz not null default now(),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null, phone text, speciality text, status text not null default 'Active',
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  work_order_number text not null unique,
  vehicle_id uuid references public.vehicles(id),
  reported_defect text, priority text default 'Medium', technician text, planned_work text,
  status text not null default 'Open', odometer numeric,
  cost_estimate numeric, actual_cost numeric,
  handover_condition text, released_verified_by text, notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text not null unique,
  expense_date date not null default current_date,
  category text not null default 'Other', amount numeric not null default 0, currency text default 'TZS',
  supplier text,
  trip_id uuid references public.trips(id),
  vehicle_id uuid references public.vehicles(id),
  load_id uuid references public.loads(id),
  work_order_id uuid references public.work_orders(id),
  incident_id uuid,
  receipt_url text, status text not null default 'Draft', notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid references public.customers(id),
  trip_id uuid references public.trips(id),
  load_id uuid references public.loads(id),
  amount numeric not null default 0, tax numeric default 0, currency text default 'TZS',
  due_date date, status text not null default 'Draft', attachment_url text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  incident_number text not null unique,
  incident_type text not null default 'Other', severity text not null default 'Low',
  occurred_at timestamptz not null default now(), location text,
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  trip_id uuid references public.trips(id),
  load_id uuid references public.loads(id),
  tire_id uuid references public.tires(id),
  description text, people_involved text, financial_impact numeric,
  status text not null default 'Open', investigator text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents(id),
  file_path text, file_name text, kind text default 'photo', notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.police_cases (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents(id),
  police_station text, case_number text, officer_contact text,
  reported_on date, follow_up_notes text, case_status text not null default 'Open',
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.exceptions (
  id uuid primary key default gen_random_uuid(),
  exception_number text not null unique,
  exception_type text not null, expected_value text, actual_value text,
  trip_id uuid references public.trips(id),
  load_id uuid references public.loads(id),
  vehicle_id uuid references public.vehicles(id),
  fuel_allocation_id uuid references public.fuel_allocations(id),
  tire_id uuid references public.tires(id),
  severity text not null default 'Medium', required_approver text,
  status text not null default 'Open', reason text, resolution_notes text,
  resolved_by uuid, resolved_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null, entity text, entity_id uuid, details jsonb,
  actor uuid default auth.uid(), created_at timestamptz not null default now()
);
grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit readable" on public.audit_logs for select to authenticated using (true);
create policy "audit insert" on public.audit_logs for insert to authenticated with check (true);

do $$
declare t text;
begin
  foreach t in array array['customers','vehicles','drivers','trips','loads','yard_zones','gate_entries',
    'yard_movements','vehicle_inspections','fuel_allocations','tires','tire_movements','technicians',
    'work_orders','expenses','invoices','incidents','evidence_files','police_cases','exceptions']
  loop
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "insert %1$s" on public.%1$I for insert to authenticated with check (true)', t);
    execute format('create policy "update %1$s" on public.%1$I for update to authenticated using (true) with check (true)', t);
    execute format('create trigger audit_cols_%1$s before insert or update on public.%1$I for each row execute function public.set_audit_columns()', t);
  end loop;
end $$;

-- SEED
insert into public.yard_zones (name, description) values
 ('Main Gate','Vehicle entry point'),('Parking','General parking'),('Loading Bay','Cargo loading'),
 ('Unloading Bay','Cargo offloading'),('Workshop','Maintenance area'),('Tire Store','Tire storage'),
 ('Exit Gate','Vehicle exit point');

insert into public.customers (name, contact_person, phone, email, address, tax_id, status) values
 ('Kilimanjaro Traders Ltd','Asha Mwinyi','+255 712 110 220','ops@kilitraders.co.tz','Dar es Salaam','TIN-100-220','Active'),
 ('Great Lakes Minerals','John Bahati','+255 754 330 118','logistics@glminerals.com','Mwanza','TIN-330-118','Active'),
 ('Serengeti Agro Supplies','Neema Kessy','+255 786 447 900','supply@serengetiagro.co.tz','Arusha','TIN-447-900','Active');

insert into public.vehicles (registration_number, vehicle_type, is_trailer, capacity, odometer, status, yard_zone) values
 ('T123 ABC','Prime Mover',false,'40 t',184320,'In Yard','Parking'),
 ('T456 DEF','Prime Mover',false,'40 t',221050,'On Trip',null),
 ('T789 GHI','Tipper',false,'25 t',98420,'Loading','Loading Bay'),
 ('T321 JKL','Prime Mover',false,'40 t',310770,'In Maintenance','Workshop'),
 ('T654 MNO','Flatbed Trailer',true,'30 t',0,'Available','Parking');

insert into public.drivers (full_name, driver_code, phone, licence_number, licence_expiry, assigned_vehicle, status) values
 ('Juma Rashid','DRV-001','+255 713 001 001','LIC-884521','2027-04-30','T123 ABC','Available'),
 ('Peter Mollel','DRV-002','+255 713 001 002','LIC-884522','2026-11-15','T456 DEF','On Trip'),
 ('Salum Kigoma','DRV-003','+255 713 001 003','LIC-884523','2027-01-20','T789 GHI','Available'),
 ('Hamisi Ally','DRV-004','+255 713 001 004','LIC-884524','2026-09-30','T321 JKL','Off Duty'),
 ('Baraka Msuya','DRV-005','+255 713 001 005','LIC-884525','2028-02-28',null,'Available');

insert into public.trips (trip_number, customer_id, origin, destination, planned_departure, planned_arrival, vehicle_id, driver_id, status, planned_distance)
select 'TRP-1001', c.id, 'Dar es Salaam', 'Mwanza', now() + interval '4 hours', now() + interval '2 days', v.id, d.id, 'Ready for Yard', 1140
from public.customers c, public.vehicles v, public.drivers d
where c.name='Kilimanjaro Traders Ltd' and v.registration_number='T123 ABC' and d.driver_code='DRV-001';
insert into public.trips (trip_number, customer_id, origin, destination, planned_departure, planned_arrival, vehicle_id, driver_id, status, planned_distance)
select 'TRP-1002', c.id, 'Mwanza', 'Dar es Salaam', now() - interval '1 day', now() + interval '1 day', v.id, d.id, 'Dispatched', 1140
from public.customers c, public.vehicles v, public.drivers d
where c.name='Great Lakes Minerals' and v.registration_number='T456 DEF' and d.driver_code='DRV-002';
insert into public.trips (trip_number, customer_id, origin, destination, planned_departure, planned_arrival, vehicle_id, driver_id, status, planned_distance)
select 'TRP-1003', c.id, 'Arusha', 'Dodoma', now() + interval '1 day', now() + interval '2 days', v.id, d.id, 'In Yard', 440
from public.customers c, public.vehicles v, public.drivers d
where c.name='Serengeti Agro Supplies' and v.registration_number='T789 GHI' and d.driver_code='DRV-003';
insert into public.trips (trip_number, customer_id, origin, destination, planned_departure, planned_arrival, status, planned_distance)
select 'TRP-1004', c.id, 'Dar es Salaam', 'Tanga', now() + interval '3 days', now() + interval '4 days', 'Draft', 350
from public.customers c where c.name='Kilimanjaro Traders Ltd';
insert into public.trips (trip_number, customer_id, origin, destination, planned_departure, planned_arrival, status, planned_distance)
select 'TRP-1005', c.id, 'Mbeya', 'Dar es Salaam', now() - interval '6 days', now() - interval '4 days', 'Closed', 820
from public.customers c where c.name='Great Lakes Minerals';

insert into public.loads (load_reference, customer_id, trip_id, cargo_description, cargo_category, expected_quantity, unit_of_measure, expected_weight, origin, destination, planned_loading_date, seal_number, status)
select 'LD-2001', t.customer_id, t.id, 'Bagged cement', 'General', 600, 'bags', 30000, t.origin, t.destination, current_date, 'SEAL-88120', 'Loaded' from public.trips t where t.trip_number='TRP-1001';
insert into public.loads (load_reference, customer_id, trip_id, cargo_description, cargo_category, expected_quantity, unit_of_measure, expected_weight, origin, destination, planned_loading_date, seal_number, status, actual_quantity, actual_weight, actual_seal_number, variance_reason)
select 'LD-2002', t.customer_id, t.id, 'Copper concentrate', 'Minerals', 28, 'tonnes', 28000, t.origin, t.destination, current_date, 'SEAL-88121', 'Verified', 27, 27000, 'SEAL-88121', 'Short loading at mine' from public.trips t where t.trip_number='TRP-1002';
insert into public.loads (load_reference, customer_id, trip_id, cargo_description, cargo_category, expected_quantity, unit_of_measure, expected_weight, origin, destination, planned_loading_date, seal_number, status)
select 'LD-2003', t.customer_id, t.id, 'Fertilizer', 'Agro', 400, 'bags', 20000, t.origin, t.destination, current_date, 'SEAL-88122', 'Awaiting Loading' from public.trips t where t.trip_number='TRP-1003';
insert into public.loads (load_reference, customer_id, trip_id, cargo_description, cargo_category, expected_quantity, unit_of_measure, expected_weight, origin, destination, planned_loading_date, seal_number, status)
select 'LD-2004', t.customer_id, t.id, 'Maize seed', 'Agro', 250, 'bags', 12500, t.origin, t.destination, current_date, 'SEAL-88123', 'Loading' from public.trips t where t.trip_number='TRP-1003';
insert into public.loads (load_reference, customer_id, trip_id, cargo_description, cargo_category, expected_quantity, unit_of_measure, expected_weight, origin, destination, planned_loading_date, seal_number, status)
select 'LD-2005', t.customer_id, t.id, 'Steel coils', 'General', 18, 'coils', 22000, t.origin, t.destination, current_date, 'SEAL-88124', 'Draft' from public.trips t where t.trip_number='TRP-1004';
insert into public.loads (load_reference, customer_id, trip_id, cargo_description, cargo_category, expected_quantity, unit_of_measure, expected_weight, origin, destination, planned_loading_date, seal_number, status)
select 'LD-2006', t.customer_id, t.id, 'Cooking oil drums', 'FMCG', 120, 'drums', 24000, t.origin, t.destination, current_date, 'SEAL-88125', 'Reconciled' from public.trips t where t.trip_number='TRP-1005';

insert into public.tires (serial_number, brand, size, pattern, status, current_location, condition)
select 'TYR-' || lpad(g::text, 4, '0'),
  (array['Michelin','Bridgestone','Goodyear','Dunlop'])[1 + (g % 4)],
  '315/80R22.5', (array['Steer','Drive','Trailer'])[1 + (g % 3)],
  case when g <= 12 then 'Installed' when g <= 17 then 'In Store' when g = 18 then 'Repair/Retread' when g = 19 then 'Inspection' else 'Missing' end,
  case when g <= 12 then 'Vehicle' else 'Tire Store' end,
  (array['Good','Fair','Worn'])[1 + (g % 3)]
from generate_series(1,20) g;

update public.tires t
set vehicle_id = (select id from public.vehicles where registration_number = 'T123 ABC'),
    wheel_position = 'Pos ' || right(t.serial_number, 2),
    installation_odometer = 150000
where t.status = 'Installed';

insert into public.fuel_allocations (reference, trip_id, vehicle_id, driver_id, fuel_type, planned_litres, approved_litres, fuel_cost, supplier, receipt_number, status)
select 'FA-3001', t.id, t.vehicle_id, t.driver_id, 'Diesel', 400, 380, 1140000, 'Puma Energy', 'RCPT-5541', 'Approved' from public.trips t where t.trip_number='TRP-1001';
insert into public.fuel_allocations (reference, trip_id, vehicle_id, driver_id, fuel_type, planned_litres, approved_litres, fuel_cost, supplier, receipt_number, status)
select 'FA-3002', t.id, t.vehicle_id, t.driver_id, 'Diesel', 420, 420, 1260000, 'Oryx', 'RCPT-5542', 'Reconciled' from public.trips t where t.trip_number='TRP-1002';
insert into public.fuel_allocations (reference, trip_id, vehicle_id, driver_id, fuel_type, planned_litres, approved_litres, fuel_cost, supplier, receipt_number, status)
select 'FA-3003', t.id, t.vehicle_id, t.driver_id, 'Diesel', 180, 0, 0, 'Total', null, 'Draft' from public.trips t where t.trip_number='TRP-1003';

insert into public.technicians (full_name, phone, speciality) values
 ('Emmanuel Shirima','+255 715 220 001','Engine'),('Rehema Mtui','+255 715 220 002','Tires & Brakes');

insert into public.work_orders (work_order_number, vehicle_id, reported_defect, priority, technician, status, odometer, cost_estimate)
select 'WO-4001', v.id, 'Air brake leak on rear axle', 'High', 'Emmanuel Shirima', 'In Progress', v.odometer, 850000
from public.vehicles v where v.registration_number='T321 JKL';

insert into public.incidents (incident_number, incident_type, severity, location, description, status, investigator, financial_impact)
values ('INC-5001','Missing Tire','High','Tire Store','One tire unaccounted for during store count','Under Investigation','Security Team',420000),
       ('INC-5002','Cargo Shortage','Medium','Loading Bay','Copper concentrate short by 1 tonne against plan','Open','Security Team',1500000);

insert into public.exceptions (exception_number, exception_type, expected_value, actual_value, severity, required_approver, status, reason, load_id)
select 'EXC-6001','Cargo Quantity Mismatch','28 tonnes','27 tonnes','High','Operations Manager','Open','Short loading at mine', l.id from public.loads l where l.load_reference='LD-2002';
insert into public.exceptions (exception_number, exception_type, expected_value, actual_value, severity, required_approver, status, reason, tire_id)
select 'EXC-6002','Tire Missing','20 tires in register','19 physically verified','Critical','Admin','Open','Store count discrepancy', t.id from public.tires t where t.status='Missing' limit 1;
insert into public.exceptions (exception_number, exception_type, expected_value, actual_value, severity, required_approver, status, reason, vehicle_id)
select 'EXC-6003','Vehicle Inspection Failure','Pass','Fail - brake defect','Medium','Maintenance Manager','Open','Vehicle held for workshop', v.id from public.vehicles v where v.registration_number='T321 JKL';

insert into public.gate_entries (direction, vehicle_id, driver_id, trip_id, odometer, vehicle_condition, yard_zone, decision, officer)
select 'IN', t.vehicle_id, t.driver_id, t.id, 184320, 'Good', 'Parking', 'Cleared', 'Gate Officer' from public.trips t where t.trip_number='TRP-1001';
insert into public.gate_entries (direction, vehicle_id, driver_id, trip_id, odometer, vehicle_condition, yard_zone, decision, officer)
select 'IN', t.vehicle_id, t.driver_id, t.id, 98420, 'Good', 'Loading Bay', 'Cleared', 'Gate Officer' from public.trips t where t.trip_number='TRP-1003';

insert into public.expenses (expense_number, category, amount, supplier, status) values
 ('EXP-7001','Fuel',1140000,'Puma Energy','Approved'),
 ('EXP-7002','Maintenance',850000,'Workshop Parts Ltd','Submitted');

insert into public.invoices (invoice_number, customer_id, amount, tax, due_date, status)
select 'INV-8001', c.id, 4500000, 810000, current_date + 14, 'Sent' from public.customers c where c.name='Kilimanjaro Traders Ltd';
insert into public.invoices (invoice_number, customer_id, amount, tax, due_date, status)
select 'INV-8002', c.id, 6200000, 1116000, current_date - 3, 'Overdue' from public.customers c where c.name='Great Lakes Minerals';
