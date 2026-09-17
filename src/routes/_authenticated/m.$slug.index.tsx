import { createFileRoute, useParams } from "@tanstack/react-router";
import { DataModule } from "@/components/orbis/DataModule";
import { modules } from "@/lib/modules";
import { moduleSlugs } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/m/$slug")({
  component: ModulePage,
});

function ModulePage() {
  const { slug } = useParams({ from: "/_authenticated/m/$slug" });
  const key = moduleSlugs[slug];
  const config = key ? modules[key] : undefined;

  if (!config) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">No module matches “{slug}”.</p>
      </div>
    );
  }

  return <DataModule config={config} />;
}
