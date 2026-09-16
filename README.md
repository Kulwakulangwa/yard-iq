# Remix of Remix of Remix of Remix of Remix of Orbis LogiFlow

Paste this into Lovable as your MVP build prompt:

Build a responsive web application called orbis logistics app— a Logistics Operations, Yard Control, and Security Accountability System.

Use Lovable with Supabase for authentication, database, storage, and role-based access. The app must be professional, simple for field staff using phones, and suitable for a logistics company managing trucks, drivers, loads, fuel, maintenance, and tire security.

Core principle:

Office creates the plan. Yard records physical reality. The system shows Expected vs Actual and creates exceptions when they do not match.

User roles

Create these roles:

Admin

Operations Manager

Dispatcher

Finance Officer

Yard Supervisor

Gate Security Officer

Loading Officer

Fuel Attendant

Maintenance Manager

Technician

Security Investigator

Auditor / Management Viewer

Users should only see modules and actions appropriate to their role.

Main layout

Use a left sidebar with three grouped sections.

OFFICE / OPERATIONS

Dashboard

Trips

Loads

Customers

Fleet

Vehicles

Drivers

Fuel Management

Maintenance

Work Orders

Technicians

Finance

Expenses

Invoices

Reports

YARD / SECURITY

Yard Dashboard

Gate Control

Yard Zones

Loading & Unloading

Load Verification

Vehicle Inspections

Tires & Assets

Fuel Station

Maintenance Handover

Incidents & Cases

Approvals

Yard Reports

ADMIN

Users & Roles

Settings

Do not create a separate “Operational Expenses” module. Use one Expenses module with categories and links to trips, vehicles, loads, maintenance, or incidents.

MVP scope

Build the following fully functional modules first.

1. Dashboard

Create two dashboards.

Office Dashboard:

Active trips

Trips awaiting dispatch

Loads awaiting verification

Fuel allocated vs issued today

Vehicles available / in maintenance / on trip

Open invoices

Today’s expenses

Operational exceptions requiring approval

Yard Dashboard:

Vehicles currently in yard

Vehicles by yard zone

Gate-ins and gate-outs today

Vehicles waiting to load

Loads awaiting verification

Fuel issued today

Inspection failures

Open incidents

Tire/asset discrepancies

Vehicles on hold

Include filters for date, vehicle, customer, and status.

2. Customers

Create customer records with:

Customer name

Contact person

Phone

Email

Address

Tax ID

Status

Notes

3. Vehicles and Drivers

Vehicles:

Registration number

Vehicle type

Truck/trailer

Capacity

Current odometer

Current status: Available, In Yard, Loading, On Trip, In Maintenance, On Hold

Current yard zone

Assigned driver

Vehicle documents expiry dates

Notes

Drivers:

Full name

Driver ID

Phone

Licence number and expiry

Assigned vehicle

Status: Available, On Trip, Suspended, Off Duty

Notes

4. Trips

Create trips with:

Trip number generated automatically

Customer

Origin

Destination

Planned departure date/time

Planned arrival date/time

Assigned vehicle

Trailer

Assigned driver

Status: Draft, Approved, Ready for Yard, In Yard, Dispatched, Delivered, Closed, Cancelled

Planned distance

Notes

Only Operations Manager can approve a trip.

A trip cannot become “Ready for Yard” without an assigned vehicle, driver, customer, and at least one approved load.

5. Loads

Loads must be a separate first-class module, linked to trips.

Load fields:

Load reference number

Customer

Linked trip

Cargo description

Cargo category

Expected quantity

Unit of measure

Expected weight

Origin

Destination

Planned loading date

Seal number

Status: Draft, Approved, Awaiting Loading, Loading, Loaded, Verified, Dispatched, Delivered, Reconciled

Notes

Attachments/photos

Actual yard fields:

Actual quantity

Actual weight

Actual seal number

Loading start/end time

Loading officer

Verification officer

Photos

Variance reason

Automatically create an exception if actual quantity, actual weight, or seal number differs from expected values.

6. Gate Control

Create Gate In and Gate Out screens optimized for mobile use.

Gate In:

Search or scan vehicle registration

Select/verify driver

Match vehicle to expected trip

Capture entry time automatically

Record odometer

Record current vehicle condition

Assign yard zone

Take photo/evidence

Create entry record

Gate Out:

Select vehicle and active trip

Verify assigned driver

Verify load quantity/weight

Verify seal number

Verify fuel issued versus allocation

Verify vehicle inspection result

Verify no active maintenance hold

Capture odometer and exit photo

Gate decision: Cleared, Cleared with Variance Approval, Hold

A security officer cannot change the approved trip, driver, or expected load. They can only record actual values and create exceptions.

7. Yard Zones

Create configurable zones:

Main Gate

Parking

Loading Bay

Unloading Bay

Fuel Station

Workshop

Tire Store

Cargo Store

Exit Gate

Show a simple yard board listing vehicles currently in each zone, their arrival time, assigned trip, and current status.

Allow Yard Supervisor to move a vehicle between zones. Every move must create a timestamped movement log.

8. Fuel Management

Create two connected areas.

Office Fuel Management:

Fuel allocation linked to a trip and vehicle

Planned litres

Approved litres

Fuel type

Reason/notes

Status: Draft, Approved, Partially Issued, Fully Issued, Reconciled

Fuel Station:

Choose approved allocation

Record pump number

Pump meter before and after

Actual litres issued

Odometer

Fuel attendant

Driver confirmation

Issue time

Photo of meter/receipt

Automatically calculate:

Allocated litres minus issued litres

Pump meter litres versus issued litres

Estimated consumption against planned distance

Create a fuel variance exception when there is a mismatch beyond an admin-configurable tolerance.

9. Tires & Assets

Create tire tracking for security and maintenance.

Tire fields:

Unique tire code / QR-ready identifier

Serial number

Brand

Size

Pattern/model

Status: In Store, Installed, Inspection, Repair/Retread, Disposal, Missing, Disputed

Current location

Installed vehicle

Wheel position

Installation odometer

Condition

Photos

Create tire movement records:

Install

Remove

Transfer

Send for repair/retread

Return to store

Dispose

A tire removal must record:

Vehicle

Wheel position

Odometer

Reason

Condition

Technician

Yard/security verifier

Before and after photos

Destination location

Create an exception for unauthorized tire movements or missing physical verification.

10. Maintenance and Handover

Work Orders:

Work order number

Vehicle

Reported defect

Priority

Assigned technician

Planned work

Status: Open, In Progress, Awaiting Inspection, Completed, Released

Odometer

Cost estimate

Actual cost

Notes and photos

Maintenance Handover:

Record vehicle condition when entering workshop

Link removed/installed tires and parts

Record technician work

Require Yard Supervisor or Security verification before vehicle release

A vehicle with an open maintenance hold cannot pass Gate Out

11. Expenses and Invoices

Expenses:

Expense number

Date

Category: Trip, Fuel, Maintenance, Yard, Administrative, Emergency, Other

Amount

Currency

Supplier/payee

Linked trip

Linked vehicle

Linked load

Linked work order

Linked incident

Receipt attachment

Status: Draft, Submitted, Approved, Paid, Rejected

Invoices:

Invoice number

Customer

Linked trip/load

Amount

Tax

Due date

Status: Draft, Sent, Partially Paid, Paid, Overdue

Attachment

12. Incidents, Evidence, and Security Cases

Create incident records with:

Incident number

Type: Missing Tire, Fuel Variance, Cargo Shortage, Seal Mismatch, Unauthorized Exit Attempt, Damage, Theft Suspected, Accident, Other

Severity: Low, Medium, High, Critical

Date/time

Yard zone or location

Linked vehicle, driver, trip, load, tire, or fuel issue

Description

People involved

Financial impact

Status: Open, Under Investigation, Escalated, Resolved, Closed

Assigned investigator

Evidence:

Photos

Documents

Witness notes

Timeline notes

Police/security case fields:

Police station

Case/reference number

Officer/contact

Date reported

Follow-up notes

Case status

13. Approvals and exceptions

Create a central Approvals page.

Any mismatch should create an exception record with:

Exception number

Type

Expected value

Actual value

Linked trip/load/vehicle/fuel/tire

Severity

Created by

Required approver

Status: Open, Approved, Rejected, Resolved

Reason and resolution notes

Examples:

Wrong driver at gate

Cargo quantity mismatch

Wrong seal number

Fuel variance

Tire missing or moved without approval

Vehicle inspection failure

Attempted exit with open maintenance hold

Use clear colours:

blue = cleared

Amber = awaiting approval

Red = hold / critical exception

Database and security rules

Create Supabase tables for:
profiles, roles, customers, vehicles, drivers, trips, loads, gate_entries, yard_zones, yard_movements, vehicle_inspections, fuel_allocations, fuel_issues, tires, tire_movements, work_orders, technicians, expenses, invoices, incidents, evidence_files, police_cases, exceptions, approvals, audit_logs.

Use row-level security.

Requirements:

All records must have created_at, created_by, updated_at, updated_by.

Do not allow deletion of completed operational records. Use status changes and audit logs instead.

Every sensitive action must be logged in audit_logs.

Store evidence files in Supabase Storage.

A user cannot approve their own fuel issue, tire removal, gate variance, or expense.

Gate staff cannot edit Office planning data.

Office users cannot alter actual gate, fuel station, inspection, or asset-verification results after submission.

UI requirements

Clean modern logistics dashboard design.

Use a light background with dark text and blue as the primary action/accent colour.

Use icons in the sidebar.

Mobile-friendly forms for gate officers, loading officers, fuel attendants, and technicians.

Put status badges clearly on all cards and tables.

Include global search for trip number, load reference, vehicle registration, driver name, tire code, and incident number.

Include printable/exportable daily gate report, fuel issue report, active-trip report, tire movement report, and incident report.

Seed demo data for:

5 vehicles

5 drivers

3 customers

5 trips

6 loads

20 tires

3 fuel allocations

3 yard zones

2 open incidents

3 exceptions

Build the MVP with the Office and Yard workspaces visibly separate, but keep them connected through the same trip, vehicle, load, fuel, and asset records.

After Lovable generates the first version, ask it next: “Implement Supabase database tables, authentication, role permissions, and the Expected vs Actual exception engine for the modules already created.”  I’ll remove the Fuel Station issuance workflow, Cargo Store zone, tire QR identifier, and photo requirements. Add this correction to your Lovable prompt:

Changes to MVP scope

Do not build a Fuel Station module or any fuel dispensing workflow.

Remove all fuel station fields and features, including:

Approved allocation selection

Pump number

Pump meter readings

Actual litres issued

Odometer capture for fuel

Fuel attendant

Driver confirmation

Issue time

Fuel receipt or meter photos

Keep Fuel Management only on the Office / Operations side for:

Fuel budget/allocation per trip

Fuel type

Approved litres

Fuel cost

Supplier

Fuel receipt number

Status: Draft, Approved, Reconciled

Fuel expense reporting by trip, vehicle, and driver

Remove Cargo Store from Yard Zones.

Use these Yard Zones only:

Main Gate

Parking

Loading Bay

Unloading Bay

Workshop

Tire Store

Exit Gate

For Tires & Assets, remove:

Unique tire code / QR-ready identifier

Photo fields

Before and after photo requirements

Track tires using:

Serial number

Brand

Size

Pattern/model

Status

Current location

Installed vehicle

Wheel position

Installation odometer

Condition

Movement history

For tire removal, require:

Vehicle

Wheel position

Odometer

Reason

Condition

Technician

Yard/security verifier

Destination location

Approval when required

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f6a05690-2e5b-4899-bcac-050785b07e39).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
