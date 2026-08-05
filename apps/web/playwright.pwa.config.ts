import { defineConfig, devices } from "@playwright/test";

/**
 * E2E khusus PWA — WAJIB build produksi: service worker dimatikan saat `next dev`.
 * Terpisah dari playwright.config.ts agar suite utama tetap cepat.
 */
export default defineConfig({
  testDir: "./e2e-pwa",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure" },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npx next build && npx next start -p 3200",
    url: "http://localhost:3200",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
