import type { ModuleKey } from "./modules";

export type NavItem = {
  label: string;
  icon: string;
  to: string;
  module?: ModuleKey;
};

export type NavGroup = { group: string; items: NavItem[] };

export const nav: NavGroup[] = [
  {
    group: "Office / Operations",
    items: [
      { label: "Dashboard", icon: "LayoutDashboard", to: "/dashboard" },
      { label: "Trips", icon: "Route", to: "/m/trips", module: "trips" },
      { label: "Loads", icon: "Package", to: "/m/loads", module: "loads" },
      { label: "Customers", icon: "Building2", to: "/m/customers", module: "customers" },
      { label: "Contracts", icon: "FileSignature", to: "/m/contracts", module: "contracts" },
      { label: "Vehicles", icon: "Truck", to: "/vehicles" },
      { label: "Drivers", icon: "IdCard", to: "/drivers" },
      { label: "Driver Payments", icon: "Wallet", to: "/m/driver-payments", module: "driver_payments" },
      { label: "Fuel Management", icon: "Fuel", to: "/m/fuel", module: "fuel_allocations" },
      { label: "Work Orders", icon: "Wrench", to: "/m/work-orders", module: "work_orders" },
      { label: "Maintenance", icon: "Settings2", to: "/m/maintenance", module: "vehicle_maintenance" },
      { label: "Technicians", icon: "HardHat", to: "/technicians" },
      { label: "Expenses", icon: "Receipt", to: "/expenses" },
      { label: "Operational Expenses", icon: "Landmark", to: "/m/operational-expenses", module: "operational_expenses" },
      { label: "Invoices", icon: "FileText", to: "/invoices" },
      { label: "Finance", icon: "PiggyBank", to: "/finance" },
      { label: "Reports", icon: "BarChart3", to: "/reports" },
    ],
  },
  {
    group: "Yard / Security",
    items: [
      { label: "Yard Dashboard", icon: "Gauge", to: "/yard" },
      { label: "Gate Control", icon: "DoorOpen", to: "/gate" },
      { label: "Yard Zones", icon: "Map", to: "/zones" },
      { label: "Load Verification", icon: "ClipboardCheck", to: "/verification" },
      { label: "Vehicle Inspections", icon: "SearchCheck", to: "/m/inspections", module: "vehicle_inspections" },
      { label: "Tires & Assets", icon: "CircleDot", to: "/m/tires", module: "tires" },
      { label: "Tire Movements", icon: "ArrowLeftRight", to: "/m/tire-movements", module: "tire_movements" },
      { label: "Maintenance Handover", icon: "Factory", to: "/maintenance-handover" },
      { label: "Incidents & Cases", icon: "ShieldAlert", to: "/m/incidents", module: "incidents" },
      { label: "Police Cases", icon: "Landmark", to: "/m/police-cases", module: "police_cases" },
      { label: "Approvals", icon: "BadgeCheck", to: "/approvals" },
      { label: "Driver Voucher", icon: "Smartphone", to: "/voucher" },
    ],
  },
  {
    group: "Admin",
    items: [
      { label: "Users & Roles", icon: "Users", to: "/users" },
      { label: "Settings", icon: "Settings", to: "/settings" },
    ],
  },
];

export const moduleSlugs: Record<string, ModuleKey> = {
  trips: "trips",
  loads: "loads",
  customers: "customers",
  contracts: "contracts",
  vehicles: "vehicles",
  drivers: "drivers",
  fuel: "fuel_allocations",
  "work-orders": "work_orders",
  maintenance: "vehicle_maintenance",
  "driver-payments": "driver_payments",
  "operational-expenses": "operational_expenses",
  technicians: "technicians",
  expenses: "expenses",
  invoices: "invoices",
  inspections: "vehicle_inspections",
  tires: "tires",
  "tire-movements": "tire_movements",
  incidents: "incidents",
  "police-cases": "police_cases",
  zones: "yard_zones",
};
