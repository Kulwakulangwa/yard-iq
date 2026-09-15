# Richer list pages, with convoy trips shown per vehicle

Most list pages today are a plain table: a search box and a few narrow columns.
This plan gives every list page the same fuller layout you get on the trip and
driver screens, and makes convoy trips readable at a glance.

## The new page layout

Every list page gains, above its table:

- **Summary cards** with the numbers that matter for that page (counts and money
  totals in TZS, with the USD equivalent underneath where the page is money-based).
- **Status tabs** (All / Draft / In-Transit / Completed …) built from that page's
  own status values, with a count on each tab.
- **Search** stays, and an **Export** button stays.
- **Row actions menu** at the end of each row: View details, Edit, and the
  status moves that make sense for that record — instead of only "click the row".
- Wider, full-width tables with more useful columns, readable on a phone
  (fixed-size chips never squeeze the text).

## Which pages

Applied to all list pages:

- Trips, Loads, Fuel Management, Expenses, Operational Expenses
- Maintenance, Work Orders, Technicians, Tires, Tire Movements
- Customers, Contracts, Invoices, Driver Payments, Vehicle Inspections,
  Incidents, Police Cases

Existing screens (Vehicles, Drivers, Technicians summaries, Dashboard, Finance,
Voucher) keep everything they already do — nothing is removed.

## Convoy trips: one line per vehicle

On the Trips page a convoy trip is shown as a group:

- A trip header line: trip code, route, contract value, advance, status, actions.
- Underneath, **one line per vehicle** in the convoy showing that vehicle, its
  trailer, its driver, its role (lead / follower) and its own latest reported
  location and how long ago it was reported.
- A "Convoy · 3 vehicles" marker on the trip line so grouped rows are obvious.
- Single-vehicle trips stay exactly as they are — one line, no group.

Loads, Fuel and Expenses rows that belong to a convoy trip show which vehicle of
the convoy they relate to, where that link exists.

## Per-page summary cards

- Trips: in transit, contract revenue, advances paid, convoy trips.
- Loads: loads planned, awaiting verification, variance count.
- Fuel: litres approved, fuel cost, allocations pending.
- Expenses: logged, verified, pending (amount and count).
- Operational Expenses: total spend, spend this month, top category.
- Maintenance / Work Orders: jobs open, total cost, paid, outstanding.
- Tires: tires in service, in store, scrapped; movements this month.
- Invoices: invoiced, paid, outstanding.
- Driver Payments: salaries, advances, bonuses.
- Customers / Contracts: active count, contracted value.
- Incidents / Police Cases: open, under investigation, financial impact.

## Technical notes

- Extend `ModuleConfig` in `src/lib/modules.ts` with optional `stats`,
  `tabs` (status groupings) and `rowActions` descriptors so `DataModule` renders
  the richer shell generically instead of each page being hand-written.
- `DataModule` gains: a stat card strip (reusing `Stat`), a tab bar derived from
  `statusKey` values, a `DropdownMenu` actions cell, and full-width container.
  It keeps `useRows`, `exportCsv`, `StatusBadge`, `logAudit` and the existing
  editor dialog (now via `useRecordEditor`) so behaviour is unchanged.
- Money stats read the saved rate through `useFxRate` and format with
  `src/lib/money.ts`.
- Convoy grouping: `DataModule` accepts an optional `groupBy` render hook; the
  trips module supplies it, querying `trip_vehicles` (joined to `vehicles`,
  `drivers`) plus the latest `trip_locations` row per `trip_vehicle_id`, and
  renders child rows under each trip. No schema change is needed — the existing
  `trip_vehicles` and `trip_locations` tables cover it.
- Header rows use `grid-cols-[minmax(0,1fr)_auto]` with `min-w-0` / `shrink-0`
  so cards and chips survive narrow phone widths.
- Roadmap gets the new task added before implementation starts.
