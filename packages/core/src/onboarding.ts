import { z } from "zod";

/** Onboarding langkah 4 — data dasar (ui-ux-spec §3.8). Shared client/server. */

export const PRIMARY_GOALS = ["fitter", "better_sleep", "lose_weight", "build_habits"] as const;

export const primaryGoalSchema = z.enum(PRIMARY_GOALS);
export type PrimaryGoal = z.infer<typeof primaryGoalSchema>;

export const GOAL_LABELS: Record<PrimaryGoal, { title: string; icon: string }> = {
  fitter: { title: "Lebih Bugar", icon: "🏃" },
  better_sleep: { title: "Tidur Lebih Baik", icon: "🌙" },
  lose_weight: { title: "Turun Berat", icon: "⚖️" },
  build_habits: { title: "Bangun Kebiasaan", icon: "✨" },
};

export const onboardingProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Nama panggilan wajib diisi").max(50),
  dateOfBirth: z.coerce
    .date()
    .refine((d) => d < new Date(), { message: "Tanggal lahir tidak valid" })
    .refine((d) => d > new Date("1900-01-01"), { message: "Tanggal lahir tidak valid" })
    .optional(),
  heightCm: z.number().min(50).max(250).optional(),
  weightKg: z.number().min(20).max(400).optional(),
  primaryGoal: primaryGoalSchema,
});
export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;

/** Onboarding langkah 5 — consent eksplisit per poin (UU PDP; migration 0004). */
export const CONSENT_KEYS = ["health_data_processing", "ai_analysis", "notifications"] as const;
export const consentKeySchema = z.enum(CONSENT_KEYS);
export type ConsentKey = z.infer<typeof consentKeySchema>;

export const CONSENT_COPY: Record<ConsentKey, { label: string; required: boolean }> = {
  health_data_processing: {
    label: "Saya setuju data kesehatan saya diproses untuk fitur inti ArtaHealth (skor, riwayat, target).",
    required: true,
  },
  ai_analysis: {
    label: "Saya setuju data kesehatan saya dianalisis AI untuk insight harian dan chat.",
    required: false,
  },
  notifications: {
    label: "Saya ingin menerima pengingat personal (minum, tidur, kebiasaan).",
    required: false,
  },
};
