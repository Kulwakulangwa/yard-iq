import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "operations_manager"
  | "dispatcher"
  | "finance_officer"
  | "yard_supervisor"
  | "gate_security_officer"
  | "loading_officer"
  | "fuel_attendant"
  | "maintenance_manager"
  | "technician"
  | "security_investigator"
  | "auditor";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUser(data.user ?? null);
      if (data.user) {
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        if (active) setRoles((r ?? []).map((x) => String(x.role)));
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { user, roles, loading, isAdmin: roles.includes("admin") };
}
