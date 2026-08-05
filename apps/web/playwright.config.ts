import { defineConfig, devices } from "@playwright/test";

/**
 * E2E offline-first (CONTEXT §9): fitur logging diuji dengan network dimatikan.
 * Port 3100 agar tidak bentrok dev server manual di 3000.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  // mobile-first 360px — sesuai target utama produk
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
