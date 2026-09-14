import { useQuery } from "@tanstack/react-query";

import { db } from "@/lib/db";
import { DEFAULT_FX } from "@/lib/money";

export const FX_SETTING_KEY = "usd_tzs_rate";

/** Saved USD → TZS rate from Settings, falling back to the built-in default. */
export function useFxRate() {
  const { data } = useQuery({
    queryKey: ["fx-rate"],
    queryFn: async () => {
      const { data, error } = await db
        .from("app_settings")
        .select("value")
        .eq("key", FX_SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      const rate = Number(data?.value);
      return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_FX;
    },
  });
  return data ?? DEFAULT_FX;
}
