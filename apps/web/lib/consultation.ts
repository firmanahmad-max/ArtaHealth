"use client";
import {
  buildConsultationReport, summarizeSeries, adherencePct, CONDITION_LABEL_ID,
  type ConsultationReport, type ReportBiomarker, type ReportWarning,
  type ReportMedication, type SeriesPoint,
} from "@arta/core";
import { db } from "./db";
import { getActiveProfileId } from "./sync";
import { ageFromDob } from "./family";
import { earlyWarningReport } from "./early-warning";

/**
 * Mode Konsultasi (V3-1 · MK-1) — rakit Laporan Dokter dari data profil aktif di Dexie
 * (default 90 hari), lalu engine core menyusunnya. On-device, deterministik, non-diagnosis.
 */

const WINDOW_DAYS = 90;

type Cls = { band?: { label?: string }; zone?: string; guidelineRef?: string } | null;

const BM_LABEL: Record<string, string> = {
  bp: "Tekanan darah",
  "glucose:gdp": "Gula darah puasa", "glucose:gds": "Gula darah sewaktu",
  "glucose:pp2": "Gula darah 2 jam PP", "glucose:hba1c": "HbA1c",
  uric_acid: "Asam urat", lipid: "Kolesterol total",
};
const bmUnit = (biomarker: string, context: string | null): string =>
  biomarker === "bp" ? "mmHg" : context === "hba1c" ? "%" : "mg/dL";

const num = (arr: number[]): number | null => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
const round1 = (v: number | null): number | null => (v == null ? null : Math.round(v * 10) / 10);
const distinctDays = (isos: string[]): number => new Set(isos.map((s) => s.slice(0, 10))).size;

/** Susun laporan konsultasi untuk profil aktif (default 90 hari terakhir). */
export async function consultationReport(days = WINDOW_DAYS, nowMs = Date.now()): Promise<ConsultationReport> {
  const pid = await getActiveProfileId();
  const fromMs = nowMs - days * 86_400_000;
  const fromISO = new Date(fromMs).toISOString();
  const toISO = new Date(nowMs).toISOString();
  const inWindow = (iso: string | null | undefined): boolean => !!iso && new Date(iso).getTime() >= fromMs;

  const [members, conditions, readings, meds, intakes, sleeps, hydr, acts, foods, docs, ewReport] =
    await Promise.all([
      db.family_members.toArray(),
      db.monitored_conditions.toArray(),
      db.biomarker_readings.toArray(),
      db.medications.toArray(),
      db.medication_intakes.toArray(),
      db.sleep_logs.toArray(),
      db.hydration_logs.toArray(),
      db.activity_logs.toArray(),
      db.food_logs.toArray(),
      db.medical_documents.toArray(),
      earlyWarningReport(nowMs),
    ]);

  const mine = <T extends { profileId: string; deletedAt: string | null }>(rows: T[]) =>
    rows.filter((r) => r.profileId === pid && !r.deletedAt);

  // ── Pasien ──
  const self = members.find((m) => m.isSelf && !m.deletedAt);
  const displayName = self?.displayName ?? (await db.meta.get("displayName"))?.value ?? undefined;
  const patient = {
    name: displayName as string | undefined,
    age: ageFromDob(self?.dob),
    sex: (self?.sex ?? null) as "male" | "female" | null,
    conditions: mine(conditions).filter((c) => c.status !== "resolved")
      .map((c) => CONDITION_LABEL_ID[c.condition] ?? c.condition),
  };

  // ── Biomarker (kelompokkan per jenis/konteks) ──
  const bmRows = mine(readings).filter((r) => inWindow(r.measuredAt))
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const groups = new Map<string, typeof bmRows>();
  for (const r of bmRows) {
    const key = r.biomarker === "glucose" ? `glucose:${r.context ?? "gdp"}` : r.biomarker;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const biomarkers: ReportBiomarker[] = [];
  for (const [key, rows] of groups) {
    const latest = rows[rows.length - 1]!;
    const cls = latest.classification as Cls;
    const context = latest.context ?? null;
    let latestValue: string;
    let series: SeriesPoint[] | undefined;
    if (latest.biomarker === "bp") {
      latestValue = `${latest.values.systolic ?? "?"}/${latest.values.diastolic ?? "?"}`;
      series = rows.filter((r) => typeof r.values.systolic === "number")
        .map((r) => ({ t: r.measuredAt, value: r.values.systolic! }));
    } else if (latest.biomarker === "lipid") {
      const tc = latest.values.totalChol;
      latestValue = tc != null ? String(tc) : "—";
      series = rows.filter((r) => typeof r.values.totalChol === "number")
        .map((r) => ({ t: r.measuredAt, value: r.values.totalChol! }));
    } else {
      latestValue = String(latest.values.value ?? "—");
      series = rows.filter((r) => typeof r.values.value === "number")
        .map((r) => ({ t: r.measuredAt, value: r.values.value! }));
    }
    biomarkers.push({
      key,
      label: BM_LABEL[key] ?? key,
      unit: bmUnit(latest.biomarker, context),
      latestValue,
      latestAtISO: latest.measuredAt,
      zoneLabel: cls?.band?.label,
      guidelineRef: cls?.guidelineRef,
      summary: series && series.length ? summarizeSeries(series) : undefined,
    });
  }

  // ── Early Warning ──
  const warnings: ReportWarning[] = ewReport.warnings.map((w) => ({
    label: w.metric.label, text: w.message, severity: w.result.severity,
  }));

  // ── Obat + kepatuhan (jendela) ──
  const myIntakes = mine(intakes).filter((i) => inWindow(i.scheduledAt));
  const medications: ReportMedication[] = mine(meds).map((m) => {
    const forMed = myIntakes.filter((i) => i.medicationId === m.id);
    const taken = forMed.filter((i) => i.status === "taken").length;
    const sched = forMed.length;
    const times = m.schedule?.times?.join(", ") ?? "";
    return {
      name: m.dosage ? `${m.name} (${m.dosage})` : m.name,
      schedule: times,
      adherencePct: adherencePct(sched, taken),
    };
  });

  // ── Gaya hidup (rata-rata jendela) ──
  const sleepH = mine(sleeps).filter((s) => inWindow(s.sleepEnd))
    .map((s) => (new Date(s.sleepEnd).getTime() - new Date(s.sleepStart).getTime()) / 3_600_000)
    .filter((h) => h > 0 && h < 24);
  const hydrRows = mine(hydr).filter((h) => inWindow(h.loggedAt));
  const hydrDays = distinctDays(hydrRows.map((h) => h.loggedAt));
  const hydrTotal = hydrRows.reduce((s, h) => s + (h.volumeMl ?? 0), 0);
  const actMin = mine(acts).filter((a) => inWindow(a.loggedAt))
    .map((a) => a.durationMin ?? 0).filter((m) => m > 0);
  const lifestyle = {
    sleepAvgH: round1(num(sleepH)),
    hydrationAvgMl: hydrDays > 0 ? Math.round(hydrTotal / hydrDays) : null,
    activityAvgMin: actMin.length ? Math.round(num(actMin)!) : null,
  };

  // ── Gizi (rata-rata harian jendela) ──
  const foodRows = mine(foods).filter((f) => inWindow(f.loggedAt));
  const foodDays = distinctDays(foodRows.map((f) => f.loggedAt));
  const nutrition = foodDays > 0
    ? {
        sodiumAvgMg: Math.round(foodRows.reduce((s, f) => s + (f.sodiumMg ?? 0), 0) / foodDays),
        sugarAvgG: Math.round(foodRows.reduce((s, f) => s + (f.sugarG ?? 0), 0) / foodDays),
        note: "Rata-rata per hari (hari dengan catatan).",
      }
    : null;

  // ── Dokumen medis (Vault) ──
  const documents = mine(docs)
    .filter((d) => inWindow(d.docDate ? `${d.docDate}T00:00:00Z` : null))
    .sort((a, b) => (b.docDate ?? "").localeCompare(a.docDate ?? ""))
    .map((d) => ({ title: `Dokumen ${d.kind}`, dateISO: d.docDate ?? null, kind: d.kind }));

  return buildConsultationReport({
    patient,
    range: { fromISO, toISO, days },
    biomarkers, warnings, medications, lifestyle, nutrition, documents,
    generatedAtISO: new Date(nowMs).toISOString(),
  });
}
