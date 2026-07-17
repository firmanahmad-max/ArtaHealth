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

export type HydrationLogInput = z.infer<typeof hydrationLogSchema>;
export type SleepLogInput = z.infer<typeof sleepLogSchema>;
export type ActivityLogInput = z.infer<typeof activityLogSchema>;
export type MoodLogInput = z.infer<typeof moodLogSchema>;
export type WeightLogInput = z.infer<typeof weightLogSchema>;
