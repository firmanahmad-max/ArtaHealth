/**
 * Penyaring privasi Sentry — logika murni, diuji di core.
 * Aturan keras CONTEXT §3 aturan 5: data kesehatan TIDAK PERNAH masuk Sentry.
 * Dipakai `apps/web/sentry.shared.ts` sebagai beforeBreadcrumb / beforeSend.
 */

// Semua panggilan data kesehatan lewat host ini (Supabase REST & Edge Function).
const HEALTH_ENDPOINTS = /\/rest\/v1|\/functions\/v1|\.supabase\.co/i;

export interface ScrubBreadcrumb {
  category?: string;
  data?: Record<string, unknown>;
}

/** Buang breadcrumb yang bisa memuat data kesehatan; null = jangan kirim. */
export function scrubBreadcrumb<T extends ScrubBreadcrumb>(breadcrumb: T): T | null {
  if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
    const url = String(breadcrumb.data?.url ?? "");
    if (HEALTH_ENDPOINTS.test(url)) return null; // URL/query bisa memuat nilai & profile_id
    if (breadcrumb.data) {
      delete breadcrumb.data.request_body;
      delete breadcrumb.data.response_body;
    }
  }
  // object yang di-console.log bisa berisi log kesehatan
  if (breadcrumb.category === "console") return null;
  return breadcrumb;
}

export interface ScrubEvent {
  request?: { data?: unknown; cookies?: unknown; headers?: unknown };
  user?: unknown;
}

/** Strip muatan request & identitas user dari event sebelum dikirim. */
export function scrubEvent<T extends ScrubEvent>(event: T): T {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
  }
  delete event.user;
  return event;
}
