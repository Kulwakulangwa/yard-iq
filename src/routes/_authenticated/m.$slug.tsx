import { createFileRoute, Outlet, useLocation, useParams } from "@tanstack/react-router";
import { DataModule } from "@/components/orbis/DataModule";
import { ExpensesPage } from "@/components/orbis/ExpensesPage";
import { FuelManagementPage } from "@/components/orbis/FuelManagementPage";
import { modules } from "@/lib/modules";
import { moduleSlugs } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/m/$slug")({
  component: ModulePage,
});

function ModulePage() {
  const { slug } = useParams({ from: "/_authenticated/m/$slug" });
  const { pathname } = useLocation();
  const key = moduleSlugs[slug];
  const config = key ? modules[key] : undefined;

  if (!config) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">No module matches "{slug}".</p>
      </div>
    );
  }

  // /m/trips        → 2 segments → show the list
  // /m/trips/<id>   → 3 segments → render the child (detail) route
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 2) return <Outlet />;

  // Custom pages for specific modules
  if (config.table === "expenses") return <ExpensesPage />;
  if (config.table === "fuel_allocations") return <FuelManagementPage />;

  return <DataModule config={config} />;
}
