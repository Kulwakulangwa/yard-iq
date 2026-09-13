import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/auth", replace: true }); },
  head: () => ({ meta: [
    { title: "Staff access — Orbis Logistics" },
    { name: "description", content: "Staff sign-in for Orbis Logistics operations." },
    { property: "og:title", content: "Staff access — Orbis Logistics" },
    { property: "og:description", content: "Secure access to Orbis fleet and yard operations." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});
