import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/orbis/AppShell";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users & Roles — Orbis Logistics" }] }),
  component: Users,
});

const db = supabase as never as { from: (t: string) => any };

const ROLES = [
  "admin",
  "operations_manager",
  "dispatcher",
  "finance_officer",
  "yard_supervisor",
  "gate_security_officer",
  "loading_officer",
  "fuel_attendant",
  "maintenance_manager",
  "technician",
  "security_investigator",
  "auditor",
];

function Users() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await db.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await db.from("user_roles").select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      toast.success("Invitation sent. User must confirm email if required.");
      return data;
    },
    onSuccess: () => {
      setEmail("");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRoles = useMutation({
    mutationFn: async (userId: string) => {
      const current = roles.filter((r) => r.user_id === userId).map((r) => r.role);
      const wanted = selected[userId] ?? current;
      const toAdd = wanted.filter((r) => !current.includes(r));
      const toRemove = current.filter((r) => !wanted.includes(r));

      for (const r of toAdd) {
        const { error } = await db.from("user_roles").insert({ user_id: userId, role: r });
        if (error) throw error;
      }
      for (const r of toRemove) {
        const row = roles.find((x) => x.user_id === userId && x.role === r);
        if (row) {
          const { error } = await db.from("user_roles").delete().eq("id", row.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_roles"] });
      toast.success("Roles updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleRole(userId: string, role: string, checked: boolean) {
    setSelected((s) => {
      const current = s[userId] ?? roles.filter((r) => r.user_id === userId).map((r) => r.role);
      const next = checked ? [...current, role] : current.filter((r) => r !== role);
      return { ...s, [userId]: next };
    });
  }

  return (
    <>
      <PageHeader title="Users & Roles" subtitle="Invite staff and assign their access roles" />

      <Card className="mb-5 p-4">
        <h2 className="mb-3 font-semibold">Invite user</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Temporary password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => createUser.mutate()} disabled={createUser.isPending || !email || !password}>
              {createUser.isPending ? "Sending…" : "Invite user"}
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const current = selected[u.id] ?? roles.filter((r) => r.user_id === u.id).map((r) => r.role);
            return (
              <Card key={u.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{u.full_name || u.email}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => saveRoles.mutate(u.id)} disabled={saveRoles.isPending}>
                    Save roles
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={current.includes(role)}
                        onChange={(e) => toggleRole(u.id, role, e.target.checked)}
                      />
                      <span className="capitalize">{role.replace(/_/g, " ")}</span>
                    </label>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
