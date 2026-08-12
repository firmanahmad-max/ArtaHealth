import { z } from "zod";

/** Semua log offline-first wajib membawa clientId (idempotency, unique per profil). */
const base = z.object({
  profileId: z.string().uuid(),
  clientId: z.string().min(8).max(64),
  loggedAt: z.coerce.date(),
});

export const hydrationLogSchema = base.extend({
  beverage: z.enum(["water", "coffee", "tea", "milk", "juice"]).default("water"),
  volumeMl: z.number().int().min(1).max(5000),
});

export const sleepLogSchema = z
  .object({
    profileId: z.string().uuid(),
    clientId: z.string().min(8).max(64),
    sleepStart: z.coerce.date(),
    sleepEnd: z.coerce.date(),
    quality: z.number().int().min(1).max(5).optional(),
  })
  .refine((v) => v.sleepEnd > v.sleepStart, { message: "sleepEnd harus setelah sleepStart" });

export const activityLogSchema = base.extend({
  activityType: z.enum(["walk", "run", "cycle", "gym", "stretch", "yoga", "other"]),
  durationMin: z.number().int().min(1).max(600).optional(),
  steps: z.number().int().min(0).max(100000).optional(),
});

export const moodLogSchema = base.extend({
  mood: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

export const weightLogSchema = base.extend({
  weightKg: z.number().min(20).max(400),
});

/**
 * Pembacaan biomarker (Fase 2). Rentang fisiologis menolak input mustahil
 * (bukan klasifikasi — itu tugas engine deterministik). client_id = idempotensi.
 */
export const biomarkerReadingSchema = z
  .discriminatedUnion("biomarker", [
    z.object({
      profileId: z.string().uuid(),
      clientId: z.string().min(8).max(64),
      measuredAt: z.coerce.date(),
      note: z.string().max(500).optional(),
      biomarker: z.literal("bp"),
      systolic: z.number().int().min(50).max(300),
      diastolic: z.number().int().min(30).max(200),
    }),
    z.object({
      profileId: z.string().uuid(),
      clientId: z.string().min(8).max(64),
      measuredAt: z.coerce.date(),
      note: z.string().max(500).optional(),
      biomarker: z.literal("glucose"),
      context: z.enum(["gdp", "gds", "pp2", "hba1c"]),
      value: z.number(),
    }),
    z.object({
      profileId: z.string().uuid(),
      clientId: z.string().min(8).max(64),
      measuredAt: z.coerce.date(),
      note: z.string().max(500).optional(),
      biomarker: z.literal("lipid"),
      totalChol: z.number().min(50).max(1000).optional(),
      ldl: z.number().min(20).max(600).optional(),
      hdl: z.number().min(10).max(200).optional(),
      tg: z.number().min(20).max(2000).optional(),
    }),
    z.object({
      profileId: z.string().uuid(),
      clientId: z.string().min(8).max(64),
      measuredAt: z.coerce.date(),
      note: z.string().max(500).optional(),
      biomarker: z.literal("uric_acid"),
      value: z.number().min(1).max(30),
      sex: z.enum(["male", "female"]),
    }),
  ])
  .refine(
    (v) => v.biomarker !== "bp" || v.systolic > v.diastolic,
    { message: "sistolik harus lebih besar dari diastolik" },
  )
  .refine(
    // HbA1c satuan % (3–20); glukosa darah lain satuan mg/dL (20–1000)
    (v) =>
      v.biomarker !== "glucose" ||
      (v.context === "hba1c" ? v.value >= 3 && v.value <= 20 : v.value >= 20 && v.value <= 1000),
    { message: "nilai gula darah di luar rentang wajar" },
  )
  .refine(
    // panel lipid wajib punya minimal satu nilai
    (v) => v.biomarker !== "lipid" || v.totalChol != null || v.ldl != null || v.hdl != null || v.tg != null,
    { message: "isi minimal satu nilai lipid" },
  );

export type BiomarkerReadingInput = z.infer<typeof biomarkerReadingSchema>;

export type HydrationLogInput = z.infer<typeof hydrationLogSchema>;
export type SleepLogInput = z.infer<typeof sleepLogSchema>;
export type ActivityLogInput = z.infer<typeof activityLogSchema>;
export type MoodLogInput = z.infer<typeof moodLogSchema>;
export type WeightLogInput = z.infer<typeof weightLogSchema>;
