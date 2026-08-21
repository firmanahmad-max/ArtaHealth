"use client";
import {
  db, type SyncTableName, type LocalHydrationLog, type LocalSleepLog, type LocalActivityLog,
  type LocalMoodLog, type LocalWeightLog, type LocalHabit, type LocalHabitCompletion,
  type LocalBiomarkerReading, type LocalMonitoredCondition,
  type LocalFastingSettings, type LocalFastingDay,
  type LocalMedication, type LocalMedicationIntake,
  type LocalProductScan, type LocalFoodLog, type LocalSavedProduct, type LocalAllergyCard,
  type LocalNutritionEater, type LocalMedicalDocument,
} from "./db";
import { getSupabase, type PrimaryProfile } from "./supabase";

/**
 * Sync engine dua arah:
 * - Push: outbox lokal diteruskan ke Supabase dengan idempotensi
 *   unique(profile_id, client_id). Gagal → antre lagi, urutan dijaga.
 * - Pull: inkremental per tabel dengan kursor `updated_at` (migration 0006);
 *   baris yang masih antre di outbox TIDAK ditimpa (niat lokal menang sampai ter-push).
 */

/** Dipakai saat dev tanpa Supabase / belum login — sync tidak berjalan untuk id ini. */
export const LOCAL_PROFILE_ID = "00000000-0000-4000-8000-000000000000";

export async function getActiveProfileId(): Promise<string> {
  const cached = await db.meta.get("profileId");
  return cached?.value ?? LOCAL_PROFILE_ID;
}

/** Panggil saat sesi valid — cache profil + target agar dashboard bekerja offline. */
export async function cacheProfile(p: PrimaryProfile): Promise<void> {
  await db.meta.bulkPut([
    { key: "profileId", value: p.id },
    { key: "displayName", value: p.display_name },
    { key: "targetHydrationMl", value: String(p.target_hydration_ml) },
    { key: "targetSteps", value: String(p.target_steps) },
  ]);
}

export async function getTargets(): Promise<{ hydrationMl: number; steps: number }> {
  const [h, s] = await Promise.all([db.meta.get("targetHydrationMl"), db.meta.get("targetSteps")]);
  return { hydrationMl: Number(h?.value) || 2500, steps: Number(s?.value) || 8000 };
}

type AnyLocalRow =
  | LocalHydrationLog | LocalSleepLog | LocalActivityLog | LocalMoodLog | LocalWeightLog
  | LocalHabit | LocalHabitCompletion | LocalBiomarkerReading | LocalMonitoredCondition
  | LocalFastingSettings | LocalFastingDay | LocalMedication | LocalMedicationIntake
  | LocalProductScan | LocalFoodLog | LocalSavedProduct | LocalAllergyCard | LocalNutritionEater
  | LocalMedicalDocument;

/** habits & monitored_conditions ber-idempoten lewat PK id (uuid client), bukan client_id. */
const CONFLICT_KEY: Record<SyncTableName, string> = {
  hydration_logs: "profile_id,client_id",
  sleep_logs: "profile_id,client_id",
  activity_logs: "profile_id,client_id",
  mood_logs: "profile_id,client_id",
  weight_logs: "profile_id,client_id",
  habits: "id",
  habit_completions: "profile_id,client_id",
  biomarker_readings: "profile_id,client_id",
  monitored_conditions: "id",
  fasting_settings: "profile_id",       // satu baris per profil
  fasting_days: "profile_id,date",      // satu baris per (profil, tanggal)
  medications: "id",
  medication_intakes: "id",
  product_scans: "id",
  food_logs: "id",
  saved_products: "id",
  allergy_cards: "profile_id",           // satu kartu per profil
  nutrition_eaters: "id",
  medical_documents: "id",
};

function toServerRow(table: SyncTableName, row: AnyLocalRow): Record<string, unknown> {
  if (table === "habits") {
    const r = row as LocalHabit;
    return {
      id: r.id, profile_id: r.profileId, name: r.name, icon: r.icon ?? null,
      schedule: r.schedule, is_active: r.isActive, created_at: r.createdAt, deleted_at: r.deletedAt,
    };
  }
  if (table === "habit_completions") {
    const r = row as LocalHabitCompletion;
    return {
      profile_id: r.profileId, client_id: r.clientId, habit_id: r.habitId,
      date: r.date, value: r.value, deleted_at: r.deletedAt,
    };
  }
  if (table === "biomarker_readings") {
    const r = row as LocalBiomarkerReading;
    return {
      profile_id: r.profileId, client_id: r.clientId, biomarker: r.biomarker,
      context: r.context, values: r.values, classification: r.classification ?? null,
      measured_at: r.measuredAt, note: r.note ?? null, deleted_at: r.deletedAt,
      // hanya kirim bila di-set → sync biomarker manual lama tak terpengaruh (kolom baru MV)
      ...(r.source ? { source: r.source } : {}),
      ...(r.vaultDocId ? { vault_doc_id: r.vaultDocId } : {}),
    };
  }
  if (table === "monitored_conditions") {
    const r = row as LocalMonitoredCondition;
    return {
      id: r.id, profile_id: r.profileId, condition: r.condition, status: r.status,
      since: r.since, note: r.note ?? null, created_at: r.createdAt, deleted_at: r.deletedAt,
    };
  }
  if (table === "fasting_settings") {
    const r = row as LocalFastingSettings;
    return {
      profile_id: r.profileId, ramadan_enabled: r.ramadanEnabled,
      ramadan_start: r.ramadanStart, ramadan_end: r.ramadanEnd,
      sunnah_schedules: r.sunnahSchedules, sahur_reminder_min: r.sahurReminderMin,
      time_correction: r.timeCorrection, latitude: r.latitude, longitude: r.longitude,
      medical_ack_at: r.medicalAckAt,
    };
  }
  if (table === "fasting_days") {
    const r = row as LocalFastingDay;
    return {
      profile_id: r.profileId, date: r.date, fasting_type: r.fastingType,
      status: r.status, confirmed: r.confirmed,
    };
  }
  if (table === "medications") {
    const r = row as LocalMedication;
    return {
      id: r.id, profile_id: r.profileId, name: r.name, dosage: r.dosage ?? null,
      schedule: r.schedule, stock: r.stock, stock_alert: r.stockAlert,
      is_active: r.isActive, created_at: r.createdAt, deleted_at: r.deletedAt,
    };
  }
  if (table === "medication_intakes") {
    const r = row as LocalMedicationIntake;
    return {
      id: r.id, medication_id: r.medicationId, profile_id: r.profileId,
      scheduled_at: r.scheduledAt, taken_at: r.takenAt, status: r.status, deleted_at: r.deletedAt,
    };
  }
  if (table === "product_scans") {
    const r = row as LocalProductScan;
    return {
      id: r.id, profile_id: r.profileId, scanned_by: r.scannedBy,
      product_name: r.productName ?? null, food_form: r.foodForm, photo_path: r.photoPath ?? null,
      extracted: r.extracted, user_corrected: r.userCorrected, verdict: r.verdict,
      scanned_at: r.scannedAt, deleted_at: r.deletedAt,
    };
  }
  if (table === "food_logs") {
    const r = row as LocalFoodLog;
    return {
      id: r.id, profile_id: r.profileId, name: r.name ?? null, meal_type: r.mealType,
      sugar_g: r.sugarG, sodium_mg: r.sodiumMg, fat_g: r.fatG, energy_kcal: r.energyKcal,
      source_scan_id: r.sourceScanId, logged_at: r.loggedAt, deleted_at: r.deletedAt,
    };
  }
  if (table === "saved_products") {
    const r = row as LocalSavedProduct;
    return {
      id: r.id, profile_id: r.profileId, product_name: r.productName, food_form: r.foodForm,
      extracted: r.extracted, last_verdict: r.lastVerdict ?? null, scan_count: r.scanCount,
      deleted_at: r.deletedAt,
    };
  }
  if (table === "allergy_cards") {
    const r = row as LocalAllergyCard;
    return {
      profile_id: r.profileId, allergens: r.allergens, notes: r.notes ?? null, deleted_at: r.deletedAt,
    };
  }
  if (table === "nutrition_eaters") {
    const r = row as LocalNutritionEater;
    return {
      id: r.id, profile_id: r.profileId, name: r.name, relation: r.relation ?? null,
      conditions: r.conditions, allergens: r.allergens, deleted_at: r.deletedAt,
    };
  }
  if (table === "medical_documents") {
    const r = row as LocalMedicalDocument;
    return {
      id: r.id, profile_id: r.profileId, kind: r.kind, doc_date: r.docDate ?? null,
      extracted: r.extracted ?? null, photo_path: r.photoPath ?? null,
      scanned_at: r.scannedAt, deleted_at: r.deletedAt,
    };
  }
  const base = { profile_id: (row as { profileId: string }).profileId, client_id: (row as { clientId: string }).clientId, deleted_at: (row as { deletedAt: string | null }).deletedAt };
  switch (table) {
    case "hydration_logs": {
      const r = row as LocalHydrationLog;
      return { ...base, beverage: r.beverage, volume_ml: r.volumeMl, logged_at: r.loggedAt, source: "manual" };
    }
    case "sleep_logs": {
      const r = row as LocalSleepLog;
      return { ...base, sleep_start: r.sleepStart, sleep_end: r.sleepEnd, quality: r.quality ?? null, source: "manual" };
    }
    case "activity_logs": {
      const r = row as LocalActivityLog;
      return { ...base, activity_type: r.activityType, duration_min: r.durationMin ?? null, steps: r.steps ?? null, logged_at: r.loggedAt, source: "manual" };
    }
    case "mood_logs": {
      const r = row as LocalMoodLog;
      return { ...base, mood: r.mood, note: r.note ?? null, logged_at: r.loggedAt };
    }
    case "weight_logs": {
      const r = row as LocalWeightLog;
      return { ...base, weight_kg: r.weightKg, logged_at: r.loggedAt };
    }
  }
}

let flushing = false;

export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  const supabase = getSupabase();
  if (!supabase) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  try {
    const profileId = await getActiveProfileId();
    if (profileId === LOCAL_PROFILE_ID) return;
    const entries = await db.outbox.orderBy("id").toArray();
    for (const entry of entries) {
      const source = db[entry.table] as unknown as { get(key: string): Promise<AnyLocalRow | undefined> };
      const row = await source.get(entry.clientId);
      if (!row) { await db.outbox.delete(entry.id!); continue; }
      const { error } = await supabase
        .from(entry.table)
        .upsert(toServerRow(entry.table, row), { onConflict: CONFLICT_KEY[entry.table] });
      if (error) {
        // berhenti di entri gagal pertama agar urutan kausal terjaga; dicoba lagi nanti
        await db.outbox.update(entry.id!, { attempts: entry.attempts + 1, lastError: error.message });
        return;
      }
      await db.outbox.delete(entry.id!);
    }
  } finally {
    flushing = false;
  }
}

// ===== Pull =====

type ServerRow = Record<string, unknown> & { updated_at: string };

function fromServerRow(table: SyncTableName, r: ServerRow): AnyLocalRow {
  if (table === "habits") {
    return {
      id: r.id, profileId: r.profile_id, name: r.name, icon: r.icon ?? undefined,
      schedule: (r.schedule as { days?: number[] })?.days ? r.schedule : { days: [1, 2, 3, 4, 5, 6, 7] },
      isActive: r.is_active, createdAt: r.created_at, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalHabit;
  }
  if (table === "habit_completions") {
    return {
      clientId: r.client_id, profileId: r.profile_id, habitId: r.habit_id,
      date: r.date, value: r.value, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalHabitCompletion;
  }
  if (table === "biomarker_readings") {
    return {
      clientId: r.client_id, profileId: r.profile_id, biomarker: r.biomarker,
      context: (r.context as string | null) ?? null,
      values: (r.values as Record<string, number>) ?? {},
      classification: r.classification ?? null,
      measuredAt: r.measured_at, note: (r.note as string | null) ?? undefined,
      source: (r.source as string | null) ?? undefined,
      vaultDocId: (r.vault_doc_id as string | null) ?? null,
      deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalBiomarkerReading;
  }
  if (table === "monitored_conditions") {
    return {
      id: r.id, profileId: r.profile_id, condition: r.condition, status: r.status,
      since: (r.since as string | null) ?? null, note: (r.note as string | null) ?? undefined,
      createdAt: r.created_at, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalMonitoredCondition;
  }
  if (table === "fasting_settings") {
    return {
      profileId: r.profile_id, ramadanEnabled: !!r.ramadan_enabled,
      ramadanStart: (r.ramadan_start as string | null) ?? null,
      ramadanEnd: (r.ramadan_end as string | null) ?? null,
      sunnahSchedules: (r.sunnah_schedules as string[]) ?? [],
      sahurReminderMin: (r.sahur_reminder_min as number) ?? 60,
      timeCorrection: (r.time_correction as Record<string, number>) ?? {},
      latitude: (r.latitude as number | null) ?? null,
      longitude: (r.longitude as number | null) ?? null,
      medicalAckAt: (r.medical_ack_at as string | null) ?? null,
    } as LocalFastingSettings;
  }
  if (table === "fasting_days") {
    return {
      id: `${r.profile_id}:${r.date}`, profileId: r.profile_id, date: r.date as string,
      fastingType: r.fasting_type, status: r.status, confirmed: !!r.confirmed,
    } as LocalFastingDay;
  }
  if (table === "medications") {
    const sched = (r.schedule as { times?: string[]; days?: number[] }) ?? {};
    return {
      id: r.id, profileId: r.profile_id, name: r.name, dosage: (r.dosage as string | null) ?? undefined,
      schedule: { times: sched.times ?? [], days: sched.days ?? [] },
      stock: (r.stock as number | null) ?? null, stockAlert: (r.stock_alert as number) ?? 5,
      isActive: !!r.is_active, createdAt: r.created_at, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalMedication;
  }
  if (table === "medication_intakes") {
    return {
      id: r.id, medicationId: r.medication_id, profileId: r.profile_id,
      scheduledAt: r.scheduled_at, takenAt: (r.taken_at as string | null) ?? null,
      status: r.status, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalMedicationIntake;
  }
  if (table === "product_scans") {
    return {
      id: r.id, profileId: r.profile_id, scannedBy: (r.scanned_by as string | null) ?? null,
      productName: (r.product_name as string | null) ?? undefined,
      foodForm: (r.food_form as "solid" | "beverage") ?? "solid",
      photoPath: (r.photo_path as string | null) ?? undefined,
      extracted: r.extracted ?? null, userCorrected: !!r.user_corrected, verdict: r.verdict ?? null,
      scannedAt: r.scanned_at, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalProductScan;
  }
  if (table === "food_logs") {
    return {
      id: r.id, profileId: r.profile_id, name: (r.name as string | null) ?? undefined,
      mealType: (r.meal_type as LocalFoodLog["mealType"]) ?? "camilan",
      sugarG: (r.sugar_g as number | null) ?? null, sodiumMg: (r.sodium_mg as number | null) ?? null,
      fatG: (r.fat_g as number | null) ?? null, energyKcal: (r.energy_kcal as number | null) ?? null,
      sourceScanId: (r.source_scan_id as string | null) ?? null,
      loggedAt: r.logged_at, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalFoodLog;
  }
  if (table === "saved_products") {
    return {
      id: r.id, profileId: r.profile_id, productName: (r.product_name as string) ?? "",
      foodForm: (r.food_form as "solid" | "beverage") ?? "solid",
      extracted: r.extracted ?? null, lastVerdict: r.last_verdict ?? null,
      scanCount: (r.scan_count as number) ?? 1,
      updatedAt: r.updated_at, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalSavedProduct;
  }
  if (table === "allergy_cards") {
    return {
      profileId: r.profile_id, allergens: (r.allergens as LocalAllergyCard["allergens"]) ?? [],
      notes: (r.notes as string | null) ?? undefined,
      updatedAt: r.updated_at, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalAllergyCard;
  }
  if (table === "nutrition_eaters") {
    return {
      id: r.id, profileId: r.profile_id, name: (r.name as string) ?? "",
      relation: (r.relation as string | null) ?? undefined,
      conditions: (r.conditions as string[]) ?? [],
      allergens: (r.allergens as LocalNutritionEater["allergens"]) ?? [],
      updatedAt: r.updated_at, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalNutritionEater;
  }
  if (table === "medical_documents") {
    return {
      id: r.id, profileId: r.profile_id, kind: (r.kind as string) ?? "lab",
      docDate: (r.doc_date as string | null) ?? null, extracted: r.extracted ?? null,
      photoPath: (r.photo_path as string | null) ?? null,
      scannedAt: r.scanned_at, deletedAt: (r.deleted_at as string | null) ?? null,
    } as LocalMedicalDocument;
  }
  const base = {
    clientId: r.client_id as string,
    profileId: r.profile_id as string,
    deletedAt: (r.deleted_at as string | null) ?? null,
  };
  switch (table) {
    case "hydration_logs":
      return { ...base, beverage: r.beverage, volumeMl: r.volume_ml, loggedAt: r.logged_at } as LocalHydrationLog;
    case "sleep_logs":
      return { ...base, sleepStart: r.sleep_start, sleepEnd: r.sleep_end, quality: r.quality ?? undefined } as LocalSleepLog;
    case "activity_logs":
      return {
        ...base, activityType: r.activity_type,
        durationMin: r.duration_min ?? undefined, steps: r.steps ?? undefined, loggedAt: r.logged_at,
      } as LocalActivityLog;
    case "mood_logs":
      return { ...base, mood: r.mood, note: r.note ?? undefined, loggedAt: r.logged_at } as LocalMoodLog;
    case "weight_logs":
      return { ...base, weightKg: r.weight_kg, loggedAt: r.logged_at } as LocalWeightLog;
  }
}

const SYNC_TABLES: SyncTableName[] = [
  "hydration_logs", "sleep_logs", "activity_logs", "mood_logs", "weight_logs",
  "habits", "habit_completions", // habits sebelum completions (FK habit_id)
  "biomarker_readings", "monitored_conditions",
  "fasting_settings", "fasting_days",
  "medications", "medication_intakes", // medications sebelum intakes (FK medication_id)
  "product_scans", "food_logs", // scans sebelum food_logs (FK source_scan_id)
  "saved_products", "allergy_cards", "nutrition_eaters",
  "medical_documents", // FK biomarker.vault_doc_id dijaga di sisi PUSH (outbox: doc di-enqueue sebelum reading)
];
const PULL_PAGE = 500;
let pulling = false;

export async function pullAll(): Promise<void> {
  if (pulling) return;
  const supabase = getSupabase();
  if (!supabase) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  pulling = true;
  try {
    const profileId = await getActiveProfileId();
    if (profileId === LOCAL_PROFILE_ID) return;
    for (const table of SYNC_TABLES) {
      try {
        await pullTable(table, profileId);
      } catch {
        // tabel gagal → coba lagi di siklus berikutnya; tabel lain tetap ditarik
      }
    }
  } finally {
    pulling = false;
  }
}

async function pullTable(table: SyncTableName, profileId: string): Promise<void> {
  const supabase = getSupabase()!;
  const cursorKey = `pullCursor:${table}`;
  let cursor = (await db.meta.get(cursorKey))?.value ?? "1970-01-01T00:00:00Z";
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("profile_id", profileId)
      .gt("updated_at", cursor)
      .order("updated_at", { ascending: true })
      .limit(PULL_PAGE);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ServerRow[];
    if (rows.length === 0) return;

    const pendingIds = new Set(
      (await db.outbox.where("table").equals(table).toArray()).map((e) => e.clientId),
    );
    const serverKeyOf = (r: ServerRow): string => {
      if (table === "habits" || table === "monitored_conditions" ||
          table === "medications" || table === "medication_intakes" ||
          table === "product_scans" || table === "food_logs" ||
          table === "saved_products" || table === "nutrition_eaters" ||
          table === "medical_documents") return r.id as string;
      if (table === "fasting_settings" || table === "allergy_cards") return r.profile_id as string; // kunci Dexie = profileId
      if (table === "fasting_days") return `${r.profile_id}:${r.date}`;      // kunci Dexie = `${profileId}:${date}`
      return r.client_id as string;
    };
    const localRows = rows.filter((r) => !pendingIds.has(serverKeyOf(r))).map((r) => fromServerRow(table, r));
    // union EntityTable tidak punya signature bulkPut gabungan → cast struktural
    const target = db[table] as unknown as { bulkPut(items: AnyLocalRow[]): Promise<unknown> };
    await db.transaction("rw", db[table], db.meta, async () => {
      await target.bulkPut(localRows);
      await db.meta.put({ key: cursorKey, value: rows[rows.length - 1]!.updated_at });
    });
    if (rows.length < PULL_PAGE) return;
  }
}

/** Pasang listener online + interval; kembalikan fungsi cleanup. */
export function startSyncLoop(): () => void {
  const tick = () => {
    void flushOutbox().then(() => pullAll());
  };
  window.addEventListener("online", tick);
  const interval = setInterval(tick, 30_000);
  tick();
  return () => {
    window.removeEventListener("online", tick);
    clearInterval(interval);
  };
}
