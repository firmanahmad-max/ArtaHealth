"use client";
import { useEffect, useState } from "react";
import {
  entitlementOf, canUse, FREE_ENTITLEMENT,
  type Entitlement, type PremiumFeature, type SubscriptionRow,
} from "@arta/core";
import { db } from "./db";
import { getSupabase } from "./supabase";
import { featurePaywall } from "./features";

/**
 * Hak akses premium (Fase 9 · RW-4c). Baca baris `subscriptions` milik akun (RLS: baca-sendiri)
 * → engine @arta/core `entitlementOf`. Disimpan di meta agar tetap benar saat offline.
 * Sakelar NEXT_PUBLIC_FEATURE_PAYWALL MATI → `usePremium` selalu true TANPA request
 * (regresi nol: semua fitur premium terbuka seperti sekarang).
 */

const KEY_ROW = "ent:row";

async function cachedRow(): Promise<SubscriptionRow | null> {
  const v = (await db.meta.get(KEY_ROW))?.value;
  if (!v) return null;
  try { return JSON.parse(v) as SubscriptionRow; } catch { return null; }
}

/** Ambil hak akses: server bila ada sesi & online, selain itu cache terakhir; default free. */
export async function loadEntitlement(nowMs = Date.now()): Promise<Entitlement> {
  const supabase = getSupabase();
  const online = typeof navigator === "undefined" || navigator.onLine;
  if (supabase && online) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (uid) {
        const { data, error } = await supabase.from("subscriptions")
          .select("tier, valid_until").eq("account_id", uid).maybeSingle();
        if (!error) {
          const row: SubscriptionRow | null = data ? { tier: data.tier, valid_until: data.valid_until } : null;
          await db.meta.put({ key: KEY_ROW, value: row ? JSON.stringify(row) : "" });
          return entitlementOf(row, nowMs);
        }
      }
    } catch { /* jatuh ke cache */ }
  }
  return entitlementOf(await cachedRow(), nowMs);
}

/** Hook hak akses (undefined = memuat). Paywall mati → tak ada request. */
export function useEntitlement(): Entitlement | undefined {
  const [ent, setEnt] = useState<Entitlement | undefined>(featurePaywall() ? undefined : FREE_ENTITLEMENT);
  useEffect(() => {
    if (!featurePaywall()) return;
    let alive = true;
    void loadEntitlement().then((e) => { if (alive) setEnt(e); });
    return () => { alive = false; };
  }, []);
  return ent;
}

/** Boleh memakai fitur premium? undefined = memuat. Paywall mati → selalu true. */
export function usePremium(feature: PremiumFeature): boolean | undefined {
  const ent = useEntitlement();
  if (!featurePaywall()) return true;
  return ent === undefined ? undefined : canUse(feature, ent, true);
}
