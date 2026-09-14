# Fix missing Add buttons, exchange rate, convoy trips and trip location

## 1. Add buttons on the summary pages

Vehicles, Drivers and Technicians currently open custom summary pages that only
list numbers — there is no way to add or edit a record there. The full add/edit
forms already exist on separate screens.

Fix: put "New vehicle", "New driver", "New technician" buttons on those summary
pages, opening the same add/edit form used elsewhere, and make each row clickable
to edit. Technicians rows become clickable too (currently they are not).

## 2. Other screens not ready to use

Sweep every menu entry and fix the same gaps:

- Rows that cannot be opened for editing.
- Pages missing an add button where records should be creatable.
- Menu links that lead nowhere useful.

Known from the current code: Vehicles, Drivers, Technicians (above). The rest of
the menu is checked one by one and anything broken is repaired in the same pass;
nothing existing is removed.

## 3. Exchange rate you control

Today the USD-to-TZS rate is hard-coded at 2,600 in the code.

Fix: add "USD to TZS exchange rate" to Settings. Everything that converts money
(trip contract values, dashboard, finance, vehicle and driver pages, vouchers,
invoices) uses that saved rate. A trip keeps its own rate once entered, so past
trips are not rewritten when the rate changes later.

## 4. Bundle (convoy) trips — several vehicles on one trip

A trip can carry more vehicles than the single truck + trailer it has now.

- A trip gets an extra "Vehicles on this trip" section where you add any number
  of vehicle + driver pairs, each with its own trailer and note.
- The first pair stays the main vehicle/driver, so existing trips and every
  current screen keep working unchanged.
- Trip lists show "3 vehicles" when it is a bundle, and the trip's vehicle and
  driver pages count the trip for each vehicle involved.

## 5. Current location, updated by the tracking officer

- Each trip gets a location panel: current location, optional checkpoint/border
  label, who reported it and when, plus an optional note.
- A tracking officer types the new location and saves; every update is kept as a
  history list under the trip, newest first.
- Trip lists and the dashboard show the latest reported location and how long ago
  it was reported, so stale trips are visible.
- For bundle trips, location can be recorded per vehicle as well as for the trip
  as a whole.

## Technical notes

- Migration adds `trip_vehicles` (trip_id, vehicle_id, trailer_id, driver_id,
  role, notes), `trip_locations` (trip_id, trip_vehicle_id nullable, location,
  checkpoint, reported_by, reported_at, notes), plus `current_location`,
  `current_location_at`, `current_location_by` on `trips` for fast list reads.
  Each new table gets GRANTs to authenticated/service_role, RLS enabled and
  policies matching existing operational tables, plus the audit trigger.
- Settings gains an `usd_tzs_rate` row in `app_settings`; `src/lib/money.ts`
  keeps 2,600 only as a fallback and reads the setting through a small hook/query
  used by the finance-aware pages.
- Vehicles/Drivers/Technicians routes reuse the existing `DataModule` dialog
  (extract the dialog or render `DataModule` in a "summary + table" mode) rather
  than duplicating form code.
- Trip editor gains two sub-panels next to `TripFinance`: convoy vehicles and
  location updates, both only after the trip is saved.
