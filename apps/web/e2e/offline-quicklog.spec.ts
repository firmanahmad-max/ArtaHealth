import { test, expect } from "@playwright/test";

/**
 * DoD fitur logging (CONTEXT §9): harus bekerja offline.
 * Konteks baru per test = IndexedDB kosong = kondisi hari pertama.
 */

test("log air bekerja saat OFFLINE dan bertahan setelah reload", async ({ page, context }) => {
  await page.goto("/");
  // hari pertama: checklist onboarding tampil
  await expect(page.getByText("Skor pertama Anda muncul setelah 3 pencatatan")).toBeVisible();

  // matikan network — logging harus tetap jalan (tulis lokal dulu)
  await context.setOffline(true);

  await page.getByRole("button", { name: "Catat", exact: true }).click(); // FAB
  await page.getByRole("button", { name: /250 ml/ }).click();

  await expect(page.getByRole("status")).toContainText("Air 250 ml tercatat");
  await expect(page.getByText("0.3 L")).toBeVisible();

  // online lagi + reload → data pulih dari IndexedDB (bukan dari server)
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText("0.3 L")).toBeVisible();
});

test("undo pada toast membatalkan log air", async ({ page, context }) => {
  await page.goto("/");
  await context.setOffline(true);

  await page.getByRole("button", { name: "Catat", exact: true }).click();
  await page.getByRole("button", { name: /600 ml/ }).click();
  await expect(page.getByText("0.6 L")).toBeVisible();

  await page.getByRole("button", { name: "Urungkan" }).click();
  await expect(page.getByText("0.6 L")).not.toBeVisible();
  // kartu hidrasi kembali ke empty state
  await expect(page.getByRole("button", { name: "+ Catat" }).first()).toBeVisible();
});

test("mood satu ketukan tercatat offline", async ({ page, context }) => {
  await page.goto("/");
  await context.setOffline(true);

  await page.getByRole("button", { name: "Catat", exact: true }).click();
  await page.getByRole("button", { name: "🙂 Mood" }).click();
  await page.getByRole("button", { name: "Mood 4 dari 5" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Mood hari ini tercatat" })).toBeVisible();
  await expect(page.getByText("🙂").first()).toBeVisible();
});

// Navigasi offline ANTAR halaman butuh service worker, yang mati di `next dev`
// (tanpa SW, router tetap mengambil RSC payload dan gagal saat offline).
// Perilaku itu diuji sungguhan di e2e-pwa/offline-shell.spec.ts pada build produksi.
