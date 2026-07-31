import * as Sentry from "@sentry/nextjs";

// Registrasi Sentry per-runtime (Next.js instrumentation hook).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Menangkap error dari React Server Components / route handlers.
export const onRequestError = Sentry.captureRequestError;
