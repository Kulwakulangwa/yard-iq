# Fleet & Finance Upgrade

Adds the trip-finance, payments, maintenance-cost and invoicing side of the business on top of the existing Orbis app. Nothing currently in the app is removed — yard, gate, loads, tires, incidents and approvals all stay exactly as they are.

Decisions applied: keep the current Orbis look and colours, border operations only (no local/two-way pricing), TZS as the default money display with USD shown alongside on border figures.

## What changes for you

**Wider, more useful dashboard**
- Full-width layout that uses the whole screen instead of the current narrow column.
- Top cards: trips in transit, total revenue (TZS with USD equivalent), cash disbursed to drivers, fuel litres logged, plus the existing exception count.
- A trips table underneath with tabs: All / In transit / Pending settlement / Completed, showing route, vehicle, driver, contract value, advance paid, cash remaining and net margin.
- Quick "New trip" button.

**Sidebar and theme**
- Sidebar can be collapsed to icons on desktop and stays a slide-out drawer on phones.
- Light/dark toggle that remembers your choice.
- Profile card at the top showing your initials and email, with sign-out.

**Trips get money attached**
- Each trip gains contract amount in USD, the exchange rate used, the resulting TZS value, and the driver advance (percentage or fixed).
- Trip detail view showing the contract, advance, all logged expenses, and the running margin.
- Status flow: Draft → Dispatched → In-Transit → Completed → Audited, moved from a menu on each row.

**Driver payments**
- Driver profile page: their trips, advances taken, salaries paid, outstanding balance.
- Record a Salary, Advance or Bonus payment; edit or delete entries.
- Monthly salary and base location added to driver records.

**Vehicle profile and maintenance**
- Vehicle profile page: details, trip history, maintenance history, revenue booked, total km.
- Maintenance records with cost, hours, assigned technician, amount paid and remaining balance, with a Paid / Partial / Unpaid badge.

**Technicians**
- Technician profile page: total jobs, total cost of their work, paid, outstanding balance.
- Record a payment against a specific job; the job's paid amount updates.
- Add phone, email and address to technician records.

**Expenses**
- Trip expenses get a verify / reject flow with counts for logged, verified and pending.
- Receipt photos can be uploaded from camera or gallery and viewed in-app.
- Separate "Operational Expenses" page for rent, loans, stationery, utilities, insurance and other non-trip costs.

**Driver voucher page**
- A stripped-down mobile form for drivers: pick their active trip, choose a category, enter litres and amount, snap the receipt, submit for audit.

**Invoices**
- Generate an invoice for a customer over a date range, pulling in un-invoiced trips automatically.
- Subtotal + 18% VAT + total, with payment recording and Draft / Sent / Partially Paid / Paid statuses.
- Printable invoice page carrying your company name, address, phone, email and TIN.

**Finance page**
- Date-range filter across everything.
- Headline figures: revenue, trip expenses, operational expenses, profit, salaries, maintenance, net profit, outstanding advances — TZS with USD equivalent.
- Report tabs: trip profitability, driver advances, driver salaries, fuel consumption, revenue, expenses. Each exports to spreadsheet and prints.

**Settings**
- Company tab gains TIN and logo.
- Financial tab: default currency, default exchange rate, notifications.
- Users & roles and audit log stay where they are.

## Technical notes

Database (additive migrations only, no drops):
- `trip_financials` — one row per trip: contract_currency, contract_amount, fx_exchange_rate, total_contract_tzs (generated), advance_input_type, advance_value, advance_paid_usd, advance_paid_tzs, customer_paid_tzs.
- `driver_payments` — driver_id, payment_type, amount_tzs, payment_date, period_label, reference_trip, notes.
- `vehicle_maintenance` — vehicle_id, maintenance_date, description, cost_tzs, duration_hours, status, technician_id, paid_amount, completed_at. Existing `work_orders` stays untouched and keeps driving the maintenance-hold gate logic.
- `operational_expenses` — description, category, amount_tzs, expense_date, receipt_url.
- `contracts` — customer_id, route, contract_currency, contract_amount, start_date, end_date, status.
- New columns: `drivers.monthly_salary_tzs`, `drivers.base_location`; `technicians.email`, `technicians.address`; `trips.trip_code`, `trips.contract_id`, `trips.invoice_id`, `trips.settled_at`, `trips.audited_at`; `invoices.period_start`, `period_end`, `subtotal_tzs`, `vat_percent` (default 18), `vat_amount_tzs`, `total_amount_tzs`, `paid_amount_tzs`, `sent_at`, `paid_at`; `trip_expenses`-equivalent fields on `expenses` (`volume_liters`); `app_settings` entries for TIN and logo.
- Every new table: audit columns, GRANTs for authenticated + service_role, RLS on, policies mirroring the existing pattern (read for authenticated, write for admin/dispatcher/finance via `has_role`), no delete on completed records.
- Public `receipts` storage bucket with authenticated upload policies.

Frontend:
- New routes under `_authenticated/`: `trips.$tripId`, `vehicles`, `vehicles.$vehicleId`, `drivers.$driverId`, `technicians.$technicianId`, `operational-expenses`, `invoices.$invoiceId`, `finance`, `voucher`. Existing `/m/$slug` generic module screens stay for everything else.
- `AppShell` gains collapse state, theme toggle (class-based dark variant in `src/styles.css`), and profile card; `max-w-[1400px]` main container widened to full width with padding.
- Reuse `exportCsv`, `toneFor`/`StatusBadge`, `logAudit` and the `DataModule` config pattern; add a `money.ts` helper for TZS/USD formatting and FX conversion.
- Money aggregation done in TanStack Query select functions over the existing supabase client calls; regenerate database types after each migration.
