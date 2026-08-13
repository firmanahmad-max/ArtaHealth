"use client";
import { db, type LocalMedication, type LocalMedicationIntake } from "./db";
import { flushOutbox, getActiveProfileId } from "./sync";
import { todayKey } from "./habits";

/**
 * Medicine Reminder offline-first (Fase 3). CRUD obat + jadwal + catatan minum.
 * Aplikasi TIDAK PERNAH menyarankan waktu/dosis (CONTEXT §4) — hanya menyimpan
 * yang diisi user. Sinkron idempoten via PK id (pola habits). Intake per dosis
 * memakai id lokal stabil (reuse) agar tak ganda antar perangkat.
 */

async function enqueue(table: "medications" | "medication_intakes", id: string): Promise<void> {
  await db.outbox.add({ table, clientId: id, attempts: 0, queuedAt: new Date().toISOString() });
}

/** Obat aktif (belum di-tombstone), urut nama. */
export async function activeMedications(): Promise<LocalMedication[]> {
  const rows = await db.medications.toArray();
  return rows
    .filter((m) => m.isActive && !m.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function addMedication(
  name: string, times: string[], opts?: { dosage?: string; days?: number[] },
): Promise<string> {
  const id = crypto.randomUUID();
  const profileId = await getActiveProfileId();
  const row: LocalMedication = {
    id, profileId, name: name.trim(), dosage: opts?.dosage?.trim() || undefined,
    schedule: { times, days: opts?.days ?? [] },
    stock: null, stockAlert: 5, isActive: true,
    createdAt: new Date().toISOString(), deletedAt: null,
  };
  await db.transaction("rw", db.medications, db.outbox, async () => {
    await db.medications.put(row);
    await enqueue("medications", id);
  });
  void flushOutbox();
  return id;
}

/** Hapus obat (tombstone + nonaktif). */
export async function removeMedication(id: string): Promise<void> {
  await db.transaction("rw", db.medications, db.outbox, async () => {
    await db.medications.update(id, { isActive: false, deletedAt: new Date().toISOString() });
    await enqueue("medications", id);
  });
  void flushOutbox();
}

/** Status minum satu dosis hari ini (null bila belum ada catatan). */
export async function intakeFor(medicationId: string, scheduledAt: string): Promise<LocalMedicationIntake | undefined> {
  const rows = await db.medication_intakes
    .where("[medicationId+scheduledAt]").equals([medicationId, scheduledAt]).toArray();
  return rows.find((r) => !r.deletedAt);
}

/** Tandai dosis (taken/skipped). Reuse baris lokal per dosis → idempoten. */
export async function setIntake(
  medicationId: string, scheduledAt: string, status: "taken" | "skipped" | "pending",
): Promise<void> {
  const profileId = await getActiveProfileId();
  const existing = await intakeFor(medicationId, scheduledAt);
  const id = existing?.id ?? crypto.randomUUID();
  const row: LocalMedicationIntake = {
    id, medicationId, profileId, scheduledAt,
    takenAt: status === "taken" ? new Date().toISOString() : null,
    status, deletedAt: null,
  };
  await db.transaction("rw", db.medication_intakes, db.outbox, async () => {
    await db.medication_intakes.put(row);
    await enqueue("medication_intakes", id);
  });
  void flushOutbox();
}

/** ISO scheduled_at untuk dosis "HH:MM" pada hari ini (waktu lokal). */
export function doseScheduledAt(hhmm: string, dateKey = todayKey()): string {
  return new Date(`${dateKey}T${hhmm.length === 5 ? hhmm : `0${hhmm}`}:00`).toISOString();
}
