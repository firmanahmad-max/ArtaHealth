"use client";
import Dexie, { type EntityTable } from "dexie";

/**
 * IndexedDB lokal — sumber kebenaran pertama untuk SEMUA logging (CONTEXT §3).
 * Tanggal disimpan sebagai ISO string. Soft delete via deletedAt (tombstone ikut disinkron).
 * Nama tabel disamakan dengan Postgres agar mapping sync 1:1.
 */

export interface LocalHydrationLog {
  clientId: string; profileId: string;
  beverage: "water" | "coffee" | "tea" | "milk" | "juice";
  volumeMl: number;
  loggedAt: string; deletedAt: string | null;
}
export interface LocalSleepLog {
  clientId: string; profileId: string;
  sleepStart: string; sleepEnd: string; quality?: number;
  deletedAt: string | null;
}
export interface LocalActivityLog {
  clientId: string; profileId: string;
  activityType: "walk" | "run" | "cycle" | "gym" | "stretch" | "yoga" | "other";
  durationMin?: number; steps?: number;
  loggedAt: string; deletedAt: string | null;
}
export interface LocalMoodLog {
  clientId: string; profileId: string;
  mood: number; note?: string;
  loggedAt: string; deletedAt: string | null;
}
export interface LocalWeightLog {
  clientId: string; profileId: string;
  weightKg: number;
  loggedAt: string; deletedAt: string | null;
}

export interface LocalHabit {
  /** uuid dibuat client — sekaligus kunci idempoten sync (upsert onConflict id) */
  id: string;
  profileId: string;
  name: string;
  icon?: string;
  /** ISO weekday 1=Sen..7=Min */
  schedule: { days: number[] };
  isActive: boolean;
  createdAt: string;
  deletedAt: string | null;
}
export interface LocalHabitCompletion {
  /** stabil per (habit, tanggal): `${habitId}:${date}` — toggle memakai baris yang sama */
  clientId: string;
  profileId: string;
  habitId: string;
  /** "YYYY-MM-DD" tanggal lokal */
  date: string;
  value: number;
  deletedAt: string | null;
}

/** Pembacaan biomarker (Fase 2). classification = hasil engine deterministik di-cache. */
export interface LocalBiomarkerReading {
  clientId: string; profileId: string;
  biomarker: "bp" | "glucose" | "lipid" | "uric_acid";
  /** konteks: glukosa gdp/gds/pp2/hba1c · asam urat male/female · null utk bp/lipid */
  context: string | null;
  /** {systolic,diastolic} · {value} · {totalChol,ldl,hdl,tg} sesuai biomarker */
  values: Record<string, number>;
  /** BiomarkerClassification dari @arta/core (di-cache utk tampil cepat/offline) */
  classification: unknown | null;
  measuredAt: string; note?: string;
  deletedAt: string | null;
}

/** Kondisi yang dipantau pengguna (Fase 2). Idempoten via PK id (pola habits). */
export interface LocalMonitoredCondition {
  id: string;
  profileId: string;
  condition: "hypertension" | "diabetes" | "dyslipidemia" | "hyperuricemia";
  status: "monitoring" | "controlled" | "resolved";
  since: string | null;
  note?: string;
  createdAt: string;
  deletedAt: string | null;
}

/** Konfigurasi mode puasa — satu baris per profil (Fase 3). Idempoten via profileId. */
export interface LocalFastingSettings {
  profileId: string;
  ramadanEnabled: boolean;
  ramadanStart: string | null;   // "YYYY-MM-DD"
  ramadanEnd: string | null;
  sunnahSchedules: string[];
  sahurReminderMin: number;
  timeCorrection: Record<string, number>; // {imsak,maghrib,...} menit
  latitude: number | null;
  longitude: number | null;
  medicalAckAt: string | null;
}

/** Status puasa per hari (Fase 3). Kunci `${profileId}:${date}`. TANPA alasan (privasi). */
export interface LocalFastingDay {
  id: string;                    // `${profileId}:${date}`
  profileId: string;
  date: string;                  // "YYYY-MM-DD" lokal
  fastingType: string;           // ramadan|senin_kamis|…|qadha|nazar
  status: "fasting" | "not_fasting";
  confirmed: boolean;
}

/** Obat + jadwal (Fase 3, modul Medicine Reminder). Idempoten via PK id. */
export interface LocalMedication {
  id: string;
  profileId: string;
  name: string;
  dosage?: string;
  schedule: { times: string[]; days: number[] }; // times "HH:MM", days ISO 1-7 (kosong = tiap hari)
  stock: number | null;
  stockAlert: number;
  isActive: boolean;
  createdAt: string;
  deletedAt: string | null;
}

/** Catatan minum obat per dosis terjadwal (Fase 3). Idempoten via PK id. */
export interface LocalMedicationIntake {
  id: string;
  medicationId: string;
  profileId: string;
  scheduledAt: string;           // ISO
  takenAt: string | null;
  status: "pending" | "taken" | "skipped" | "missed";
  deletedAt: string | null;
}

/** Riwayat pemindaian label (Fase 4). extracted+verdict di-cache. Idempoten via id. */
export interface LocalProductScan {
  id: string;
  profileId: string;
  scannedBy: string | null;
  productName?: string;
  foodForm: "solid" | "beverage";
  photoPath?: string;
  extracted: unknown;
  userCorrected: boolean;
  verdict: unknown;
  scannedAt: string;
  deletedAt: string | null;
}

/** Catatan makan (Fase 4) — basis akumulasi GGL Budget harian. Idempoten via id. */
export interface LocalFoodLog {
  id: string;
  profileId: string;
  name?: string;
  mealType: "sarapan" | "siang" | "malam" | "camilan" | "sahur" | "iftar";
  sugarG: number | null;
  sodiumMg: number | null;
  fatG: number | null;
  energyKcal: number | null;
  sourceScanId: string | null;
  loggedAt: string;
  deletedAt: string | null;
}

/** Lemari produk tersimpan (Fase 4). extracted = NutritionInput. Idempoten via id. */
export interface LocalSavedProduct {
  id: string;
  profileId: string;
  productName: string;
  foodForm: "solid" | "beverage";
  extracted: unknown;
  lastVerdict: unknown;
  scanCount: number;
  updatedAt: string;
  deletedAt: string | null;
}

/** Satu alergen yang dipantau (Big-9 atau kustom). */
export interface AllergenEntry {
  key: string;
  label?: string;
  terms?: string[];
  severity?: "mild" | "severe";
  custom?: boolean;
}

/** Kartu alergi — satu per profil (Fase 4). Kunci profileId (pola fasting_settings). */
export interface LocalAllergyCard {
  profileId: string;
  allergens: AllergenEntry[];
  notes?: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Anggota rumah yang dipindaikan (Fase 4 · NG-4b) — persona gizi ringan. Idempoten via id. */
export interface LocalNutritionEater {
  id: string;
  profileId: string;              // pemilik akun
  name: string;
  relation?: string;              // anak | orang_tua | pasangan | lainnya
  conditions: string[];           // hypertension | diabetes | dyslipidemia | gout
  allergens: AllergenEntry[];
  updatedAt: string;
  deletedAt: string | null;
}

export type LogTableName = "hydration_logs" | "sleep_logs" | "activity_logs" | "mood_logs" | "weight_logs";
export type SyncTableName = LogTableName | "habits" | "habit_completions" | "biomarker_readings" | "monitored_conditions" | "fasting_settings" | "fasting_days" | "medications" | "medication_intakes" | "product_scans" | "food_logs" | "saved_products" | "allergy_cards" | "nutrition_eaters";

export interface OutboxEntry {
  id?: number;
  table: SyncTableName;
  clientId: string;
  attempts: number;
  queuedAt: string;
  lastError?: string;
}
export interface MetaEntry { key: string; value: string }

type ArtaDB = Dexie & {
  hydration_logs: EntityTable<LocalHydrationLog, "clientId">;
  sleep_logs: EntityTable<LocalSleepLog, "clientId">;
  activity_logs: EntityTable<LocalActivityLog, "clientId">;
  mood_logs: EntityTable<LocalMoodLog, "clientId">;
  weight_logs: EntityTable<LocalWeightLog, "clientId">;
  habits: EntityTable<LocalHabit, "id">;
  habit_completions: EntityTable<LocalHabitCompletion, "clientId">;
  biomarker_readings: EntityTable<LocalBiomarkerReading, "clientId">;
  monitored_conditions: EntityTable<LocalMonitoredCondition, "id">;
  fasting_settings: EntityTable<LocalFastingSettings, "profileId">;
  fasting_days: EntityTable<LocalFastingDay, "id">;
  medications: EntityTable<LocalMedication, "id">;
  medication_intakes: EntityTable<LocalMedicationIntake, "id">;
  product_scans: EntityTable<LocalProductScan, "id">;
  food_logs: EntityTable<LocalFoodLog, "id">;
  saved_products: EntityTable<LocalSavedProduct, "id">;
  allergy_cards: EntityTable<LocalAllergyCard, "profileId">;
  nutrition_eaters: EntityTable<LocalNutritionEater, "id">;
  outbox: EntityTable<OutboxEntry, "id">;
  meta: EntityTable<MetaEntry, "key">;
};

export const db = new Dexie("artahealth") as ArtaDB;

db.version(1).stores({
  hydration_logs: "clientId, loggedAt",
  sleep_logs: "clientId, sleepEnd",
  activity_logs: "clientId, loggedAt",
  mood_logs: "clientId, loggedAt",
  weight_logs: "clientId, loggedAt",
  outbox: "++id, table",
  meta: "key",
});
// v2 (Sprint 5-6): habit engine — tabel lama tidak berubah, Dexie migrasi otomatis
db.version(2).stores({
  habits: "id, isActive",
  habit_completions: "clientId, date, habitId",
});
// v3 (Fase 2): biomarker — index [biomarker+measuredAt] melayani query trend per jenis
db.version(3).stores({
  biomarker_readings: "clientId, measuredAt, biomarker, [biomarker+measuredAt]",
});
// v4 (Fase 2): kondisi dipantau — idempoten via id (pola habits)
db.version(4).stores({
  monitored_conditions: "id, condition",
});
// v5 (Fase 3): mode puasa — settings singleton per profil, days per (profil,tanggal)
db.version(5).stores({
  fasting_settings: "profileId",
  fasting_days: "id, [profileId+date]",
});
// v6 (Fase 3): modul obat — idempoten via id; index intake per obat
db.version(6).stores({
  medications: "id, isActive",
  medication_intakes: "id, medicationId, [medicationId+scheduledAt]",
});
// v7 (Fase 4): Sadar Gizi — riwayat scan + food log (basis GGL Budget)
db.version(7).stores({
  product_scans: "id, scannedAt",
  food_logs: "id, loggedAt",
});
// v8 (Fase 4): lemari produk tersimpan — muat ulang cepat + pembanding
db.version(8).stores({
  saved_products: "id, updatedAt",
});
// v9 (Fase 4): kartu alergi — satu per profil (kunci profileId)
db.version(9).stores({
  allergy_cards: "profileId",
});
// v10 (Fase 4): anggota rumah yang dipindaikan — persona gizi ringan
db.version(10).stores({
  nutrition_eaters: "id, updatedAt",
});

/** Awal hari lokal perangkat (ISO) — batas "hari ini" untuk skor & dashboard. */
export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
