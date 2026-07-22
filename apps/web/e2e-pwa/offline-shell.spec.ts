import { test, expect, type Page } from "@playwright/test";

/**
 * PWA app-shell (CONTEXT §6). Menutup celah yang tercatat di e2e-quicklog:
 * navigasi offline ke route yang BELUM pernah dibuka.
 * Semua test menunggu service worker aktif dulu — tanpa itu tidak ada yang di-cache.
 */

async function waitForServiceWorker(page: Page) {
  await page.goto("/");
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg?.active;
  }, null, { timeout: 30_000 });
  // beri kesempatan precache selesai sebelum jaringan diputus
  await page.waitForTimeout(1500);
}

test("service worker terdaftar dan manifest PWA lengkap", async ({ page }) => {
  await waitForServiceWorker(page);

  const manifestHref = await page.getAttribute('link[rel="manifest"]', "href");
  expect(manifestHref).toBeTruthy();
  const manifest = await page.evaluate(async (href) => (await fetch(href!)).json(), manifestHref);

  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.theme_color).toBe("#0A0E1A");
  // maskable wajib ada agar ikon tidak dipotong di Android
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
});

test("halaman yang BELUM pernah dibuka tetap bisa diakses offline", async ({ page, context }) => {
  await waitForServiceWorker(page);

  // /timeline belum pernah dikunjungi di sesi ini
  await context.setOffline(true);
  await page.goto("/timeline");

  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Semua" })).toBeVisible();
});

test("reload penuh saat offline tetap memuat aplikasi, bukan halaman error browser", async ({ page, context }) => {
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.reload();
  await expect(page.getByRole("heading", { name: /Hai/ })).toBeVisible();
  await expect(page.getByText("Kebiasaan hari ini")).toBeVisible();
});

test("route yang tidak di-precache jatuh ke halaman offline yang menenangkan", async ({ page, context }) => {
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.goto("/login"); // sengaja di luar app shell
  await expect(page.getByRole("heading", { name: "Belum tersambung ke internet" })).toBeVisible();
  await expect(page.getByText(/Catatan Anda aman/)).toBeVisible();
});
