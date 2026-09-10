import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Truck, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orbis — Logistics, Yard Control & Security Accountability" },
      {
        name: "description",
        content:
          "Orbis connects office planning with yard reality: trips, loads, gate control, fuel budgets, tires and incident cases in one system.",
      },
      { property: "og:title", content: "Orbis — Logistics & Yard Control" },
      {
        property: "og:description",
        content: "Expected vs actual for every trip, load, gate movement and asset.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded bg-primary text-xs font-bold text-primary-foreground">
            OR
          </div>
          <span className="font-semibold">Orbis Logistics</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Staff sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-16">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Office creates the plan. The yard records reality.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Orbis links trips, loads, gate movements, fuel budgets, tires and maintenance — then flags every
          mismatch between what was expected and what actually happened.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/auth">Open the workspace</Link>
        </Button>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Truck, title: "Office operations", text: "Trips, loads, customers, fleet, fuel budgets, expenses and invoices." },
            { icon: ClipboardCheck, title: "Yard control", text: "Gate in and out, zone board, load verification and inspections." },
            { icon: ShieldCheck, title: "Accountability", text: "Exceptions, approvals, tire tracking and security case files." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border p-5">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
