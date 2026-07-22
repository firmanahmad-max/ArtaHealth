import withSerwistInit from "@serwist/next";

/**
 * PWA (Serwist) — CONTEXT.md §6 Sprint 5–6.
 * SW dimatikan saat `next dev` supaya HMR tidak dilayani dari cache;
 * verifikasi PWA selalu dilakukan pada build produksi.
 */

// Manifest bawaan hanya memuat aset build, bukan dokumen HTML — akibatnya
// halaman yang belum pernah dibuka (dan fallback /offline itu sendiri) tidak
// tersedia offline. Semua route V1 statis, jadi shell-nya aman di-precache.
const revision = `${Date.now()}`;
const APP_SHELL = ["/", "/timeline", "/offline"].map((url) => ({ url, revision }));

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
  additionalPrecacheEntries: APP_SHELL,
});

const nextConfig = { reactStrictMode: true, transpilePackages: ["@arta/core", "@arta/design-system"] };

export default withSerwist(nextConfig);
