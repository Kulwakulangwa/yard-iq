import { supabase } from "@/integrations/supabase/client";

/**
 * Loosely typed Supabase accessor. The app drives many tables generically
 * (module configs, dynamic reports), so the generated row types are not usable
 * at those call sites.
 */
export const db = supabase as never as {
  from: (table: string) => any;
};

export async function selectAll(table: string, columns = "*"): Promise<any[]> {
  const { data, error } = await db.from(table).select(columns);
  if (error) throw error;
  return (data ?? []) as any[];
}
