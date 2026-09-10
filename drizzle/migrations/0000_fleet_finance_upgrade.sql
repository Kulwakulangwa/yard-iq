-- New columns on existing tables
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS monthly_salary_tzs NUMERIC DEFAULT 0;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS base_location TEXT;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS contract_id UUID;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS invoice_id UUID;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS volume_liters NUMERIC;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal_tzs NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_percent NUMERIC DEFAULT 18;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_amount_tzs NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_amount_tzs NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount_tzs NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Contracts
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id),
  route TEXT,
  contract_currency TEXT NOT NULL DEFAULT 'USD',
  contract_amount NUMERIC NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts read" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "contracts insert" ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contracts update" ON public.contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER audit_cols_contracts BEFORE INSERT OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

-- Trip financials
CREATE TABLE IF NOT EXISTS public.trip_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE REFERENCES public.trips(id),
  contract_currency TEXT NOT NULL DEFAULT 'USD',
  contract_amount NUMERIC NOT NULL DEFAULT 0,
  fx_exchange_rate NUMERIC NOT NULL DEFAULT 1,
  total_contract_tzs NUMERIC GENERATED ALWAYS AS (contract_amount * fx_exchange_rate) STORED,
  advance_input_type TEXT NOT NULL DEFAULT 'percentage',
  advance_value NUMERIC NOT NULL DEFAULT 0,
  advance_paid_usd NUMERIC NOT NULL DEFAULT 0,
  advance_paid_tzs NUMERIC NOT NULL DEFAULT 0,
  customer_paid_tzs NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_financials TO authenticated;
GRANT ALL ON public.trip_financials TO service_role;
ALTER TABLE public.trip_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip_financials read" ON public.trip_financials FOR SELECT TO authenticated USING (true);
CREATE POLICY "trip_financials insert" ON public.trip_financials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "trip_financials update" ON public.trip_financials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER audit_cols_trip_financials BEFORE INSERT OR UPDATE ON public.trip_financials FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

-- Driver payments
CREATE TABLE IF NOT EXISTS public.driver_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id),
  payment_type TEXT NOT NULL DEFAULT 'Salary',
  amount_tzs NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_label TEXT,
  reference_trip UUID REFERENCES public.trips(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_payments TO authenticated;
GRANT ALL ON public.driver_payments TO service_role;
ALTER TABLE public.driver_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_payments read" ON public.driver_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "driver_payments insert" ON public.driver_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "driver_payments update" ON public.driver_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "driver_payments delete" ON public.driver_payments FOR DELETE TO authenticated USING (true);
CREATE TRIGGER audit_cols_driver_payments BEFORE INSERT OR UPDATE ON public.driver_payments FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

-- Vehicle maintenance
CREATE TABLE IF NOT EXISTS public.vehicle_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id),
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  cost_tzs NUMERIC NOT NULL DEFAULT 0,
  duration_hours NUMERIC,
  status TEXT NOT NULL DEFAULT 'Planned',
  technician_id UUID REFERENCES public.technicians(id),
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_maintenance TO authenticated;
GRANT ALL ON public.vehicle_maintenance TO service_role;
ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_maintenance read" ON public.vehicle_maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicle_maintenance insert" ON public.vehicle_maintenance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "vehicle_maintenance update" ON public.vehicle_maintenance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "vehicle_maintenance delete" ON public.vehicle_maintenance FOR DELETE TO authenticated USING (true);
CREATE TRIGGER audit_cols_vehicle_maintenance BEFORE INSERT OR UPDATE ON public.vehicle_maintenance FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

-- Operational expenses
CREATE TABLE IF NOT EXISTS public.operational_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  amount_tzs NUMERIC NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_expenses TO authenticated;
GRANT ALL ON public.operational_expenses TO service_role;
ALTER TABLE public.operational_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operational_expenses read" ON public.operational_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "operational_expenses insert" ON public.operational_expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "operational_expenses update" ON public.operational_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "operational_expenses delete" ON public.operational_expenses FOR DELETE TO authenticated USING (true);
CREATE TRIGGER audit_cols_operational_expenses BEFORE INSERT OR UPDATE ON public.operational_expenses FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();
