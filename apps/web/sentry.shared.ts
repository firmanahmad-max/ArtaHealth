import type { BrowserOptions } from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent } from "@arta/core";

/**
 * Opsi Sentry bersama untuk client/server/edge.
 *
 * ATURAN KERAS (CONTEXT §3 aturan 5): data kesehatan TIDAK PERNAH masuk Sentry.
 * Karena itu:
 * - breadcrumb jaringan ke Supabase/AI dibuang (URL & payload bisa memuat nilai
 *   kesehatan / pengenal profil),
 * - breadcrumb konsol dibuang (object yang di-log bisa berisi data log),
 * - body & cookie request di-strip dari event,
 * - PII default dimatikan, tidak ada performance tracing / session replay.
 *
 * DSN kosong (env belum diisi) → Sentry inert total; app & CI jalan normal.
 */

export const sentryOptions: BrowserOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // hemat & privasi: tanpa tracing, tanpa PII, tanpa replay layar
  tracesSampleRate: 0,
  sendDefaultPii: false,

  // logika penyaringan ada di @arta/core (diuji unit) — lihat sentry-scrub.ts
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  beforeSend: (event) => scrubEvent(event),
};
