import { createFileRoute, useParams } from "@tanstack/react-router";

import { RecordSummary } from "@/components/orbis/RecordSummary";
import { modules } from "@/lib/modules";
import { moduleSlugs } from "@/lib/nav";

export const Route = createFileRoute("/_authenticated/m/$slug/$recordId")({
  head: () => ({
    meta: [
      { title: "Record Summary — Orbis Logistics" },
      { name: "description", content: "Operational record summary, status, activity and related details in Orbis Logistics." },
      { property: "og:title", content: "Record Summary — Orbis Logistics" },
      { property: "og:description", content: "Operational record summary, status, activity and related details in Orbis Logistics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordSummaryPage,
});

function RecordSummaryPage() {
  const { slug, recordId } = useParams({ from: "/_authenticated/m/$slug/$recordId" });
  const key = moduleSlugs[slug];
  const config = key ? modules[key] : undefined;
  if (!config) return <div className="rounded-lg border bg-card p-8 text-center"><h1 className="font-semibold">Page not found</h1></div>;
  return <RecordSummary config={config} recordId={recordId} slug={slug} />;
}