-- 1. Private helper schema (not exposed through the API)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.has_any_role(_user_id, ARRAY['admin']::app_role[])
$$;

-- staff who may change operational records (auditor is read-only)
CREATE OR REPLACE FUNCTION private.can_write_ops(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.has_any_role(_user_id, ARRAY['admin','operations_manager','dispatcher','yard_supervisor','gate_security','loading_officer','fuel_attendant','maintenance_manager','technician','security_investigator','finance_officer']::app_role[])
$$;

CREATE OR REPLACE FUNCTION private.can_view_finance(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.has_any_role(_user_id, ARRAY['admin','operations_manager','finance_officer','auditor']::app_role[])
$$;

CREATE OR REPLACE FUNCTION private.can_manage_finance(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.has_any_role(_user_id, ARRAY['admin','operations_manager','finance_officer']::app_role[])
$$;

CREATE OR REPLACE FUNCTION private.can_view_people(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.has_any_role(_user_id, ARRAY['admin','operations_manager','dispatcher','finance_officer','yard_supervisor','maintenance_manager']::app_role[])
$$;

CREATE OR REPLACE FUNCTION private.can_manage_people(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT private.has_any_role(_user_id, ARRAY['admin','operations_manager','dispatcher','maintenance_manager']::app_role[])
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

-- 2. First staff account bootstraps as admin so the app is never locked out
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. SECURITY DEFINER functions in the exposed schema are no longer publicly callable
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;

-- 4. Role assignments: users see only their own, admins manage all
DROP POLICY IF EXISTS "roles readable by authenticated" ON public.user_roles;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "own role rows readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- 5. App-wide settings: staff read, admins change
DROP POLICY IF EXISTS "Authenticated users can manage app settings" ON public.app_settings;
CREATE POLICY "staff read app settings" ON public.app_settings FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));
CREATE POLICY "admins manage app settings" ON public.app_settings FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- 6. Audit trail: admins/auditors read, entries can only be written as yourself
DROP POLICY IF EXISTS "audit readable" ON public.audit_logs;
DROP POLICY IF EXISTS "audit insert" ON public.audit_logs;
CREATE POLICY "audit readable by admins and auditors" ON public.audit_logs FOR SELECT TO authenticated
  USING (private.has_any_role(auth.uid(), ARRAY['admin','auditor']::app_role[]));
CREATE POLICY "staff append own audit entries" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (private.is_staff(auth.uid()) AND actor = auth.uid());

-- 7. People/PII tables
DROP POLICY IF EXISTS "read customers" ON public.customers;
DROP POLICY IF EXISTS "insert customers" ON public.customers;
DROP POLICY IF EXISTS "update customers" ON public.customers;
CREATE POLICY "customers read" ON public.customers FOR SELECT TO authenticated USING (private.can_view_people(auth.uid()));
CREATE POLICY "customers insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (private.can_manage_people(auth.uid()));
CREATE POLICY "customers update" ON public.customers FOR UPDATE TO authenticated USING (private.can_manage_people(auth.uid())) WITH CHECK (private.can_manage_people(auth.uid()));

DROP POLICY IF EXISTS "read drivers" ON public.drivers;
DROP POLICY IF EXISTS "insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "update drivers" ON public.drivers;
CREATE POLICY "drivers read" ON public.drivers FOR SELECT TO authenticated USING (private.can_view_people(auth.uid()));
CREATE POLICY "drivers insert" ON public.drivers FOR INSERT TO authenticated WITH CHECK (private.can_manage_people(auth.uid()));
CREATE POLICY "drivers update" ON public.drivers FOR UPDATE TO authenticated USING (private.can_manage_people(auth.uid())) WITH CHECK (private.can_manage_people(auth.uid()));

DROP POLICY IF EXISTS "read technicians" ON public.technicians;
DROP POLICY IF EXISTS "insert technicians" ON public.technicians;
DROP POLICY IF EXISTS "update technicians" ON public.technicians;
CREATE POLICY "technicians read" ON public.technicians FOR SELECT TO authenticated USING (private.can_view_people(auth.uid()));
CREATE POLICY "technicians insert" ON public.technicians FOR INSERT TO authenticated WITH CHECK (private.can_manage_people(auth.uid()));
CREATE POLICY "technicians update" ON public.technicians FOR UPDATE TO authenticated USING (private.can_manage_people(auth.uid())) WITH CHECK (private.can_manage_people(auth.uid()));

-- 8. Financial tables: finance/management only
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices','contracts','trip_financials','driver_payments','operational_expenses'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.can_view_finance(auth.uid()))', t||' finance read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (private.can_manage_finance(auth.uid()))', t||' finance insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (private.can_manage_finance(auth.uid())) WITH CHECK (private.can_manage_finance(auth.uid()))', t||' finance update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (private.is_admin(auth.uid()))', t||' finance delete', t);
  END LOOP;
END $$;

-- 9. Operational tables: any assigned staff can read, only operational roles can change
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['trips','loads','vehicles','work_orders','incidents','exceptions','fuel_allocations','gate_entries','tire_movements','tires','yard_movements','yard_zones','vehicle_maintenance','vehicle_inspections','police_cases','evidence_files','trip_vehicles','trip_locations','expenses'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (private.is_staff(auth.uid()))', t||' staff read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (private.can_write_ops(auth.uid()))', t||' staff insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (private.can_write_ops(auth.uid())) WITH CHECK (private.can_write_ops(auth.uid()))', t||' staff update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (private.has_any_role(auth.uid(), ARRAY[''admin'',''operations_manager'']::app_role[]))', t||' manager delete', t);
  END LOOP;
END $$;

-- 10. Profiles: staff directory limited to signed-in staff, own profile always visible
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by staff" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_staff(auth.uid()));