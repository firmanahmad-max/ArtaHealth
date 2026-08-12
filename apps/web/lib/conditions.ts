"use client";
import { db, type LocalMonitoredCondition } from "./db";
import { flushOutbox, getActiveProfileId } from "./sync";

/**
 * Kondisi yang dipantau pengguna (Fase 2). Menyatakan niat pantau → Risk Panel
 * jadi proaktif (menampilkan biomarker relevan walau belum ada data). Offline-first
 * seperti habit (idempoten via PK id). Satu baris aktif per kondisi ditegakkan di sini.
 */

export type MonitoredCondition = LocalMonitoredCondition["condition"];

export const CONDITION_META: Record<MonitoredCondition, { label: string; icon: string; biomarker: "bp" | "glucose" | "lipid" | "uric_acid"; hint: string }> = {
  hypertension: { label: "Hipertensi", icon: "🫀", biomarker: "bp", hint: "Catat tensi" },
  diabetes: { label: "Diabetes", icon: "🩸", biomarker: "glucose", hint: "Catat gula darah" },
  dyslipidemia: { label: "Kolesterol", icon: "🧈", biomarker: "lipid", hint: "Catat lipid" },
  hyperuricemia: { label: "Asam Urat", icon: "🦴", biomarker: "uric_acid", hint: "Catat asam urat" },
};

async function enqueue(id: string): Promise<void> {
  await db.outbox.add({ table: "monitored_conditions", clientId: id, attempts: 0, queuedAt: new Date().toISOString() });
}

/** Set kondisi yang sedang dipantau (aktif, belum di-tombstone). */
export async function monitoredSet(): Promise<Set<MonitoredCondition>> {
  const rows = await db.monitored_conditions.toArray();
  const set = new Set<MonitoredCondition>();
  for (const r of rows) if (!r.deletedAt) set.add(r.condition);
  return set;
}

/** Nyalakan/matikan pantauan sebuah kondisi. Aman dipanggil berulang (idempoten). */
export async function setMonitored(condition: MonitoredCondition, on: boolean): Promise<void> {
  const profileId = await getActiveProfileId();
  const rows = await db.monitored_conditions.where("condition").equals(condition).toArray();
  const active = rows.filter((r) => !r.deletedAt && r.profileId === profileId);

  if (on) {
    if (active.length > 0) return; // sudah dipantau
    const id = crypto.randomUUID();
    const now = new Date();
    await db.transaction("rw", db.monitored_conditions, db.outbox, async () => {
      await db.monitored_conditions.put({
        id, profileId, condition, status: "monitoring",
        since: now.toISOString().slice(0, 10), createdAt: now.toISOString(), deletedAt: null,
      });
      await enqueue(id);
    });
  } else {
    const stamp = new Date().toISOString();
    await db.transaction("rw", db.monitored_conditions, db.outbox, async () => {
      for (const r of active) {
        await db.monitored_conditions.update(r.id, { deletedAt: stamp });
        await enqueue(r.id);
      }
    });
  }
  void flushOutbox();
}
