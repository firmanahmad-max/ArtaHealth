import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * PWA (Serwist) — CONTEXT.md §6 Sprint 5–6.
 * SW dimatikan saat `next dev` supaya HMR tidak dilayani dari cache;
 * verifikasi PWA selalu dilakukan pada build produksi.
 */

// Manifest bawaan hanya memuat aset build, bukan dokumen HTML — akibatnya
// halaman yang belum pernah dibuka (dan fallback /offline itu sendiri) tidak
// tersedia offline. Semua route V1 statis, jadi shell-nya aman di-precache.
const revision = `${Date.now()}`;
const APP_SHELL = ["/", "/timeline", "/chat", "/offline"].map((url) => ({ url, revision }));

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
  additionalPrecacheEntries: APP_SHELL,
});

const nextConfig = { reactStrictMode: true, transpilePackages: ["@arta/core", "@arta/design-system"] };

// Sentry membungkus paling luar. Upload source map DIMATIKAN supaya build/CI
// tidak butuh SENTRY_AUTH_TOKEN; monitoring runtime tetap aktif via DSN saja.
export default withSentryConfig(withSerwist(nextConfig), {
  silent: true,
  disableLogger: true,
  telemetry: false,
  sourcemaps: { disable: true },
  // pangkas bundle: kita tidak memakai Session Replay maupun debug logging
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
});
