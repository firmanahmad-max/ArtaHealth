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

test("mood satu ketukan tercatat offline dan muncul di Timeline", async ({ page, context }) => {
  // muat chunk kedua route saat masih online — navigasi offline ke route yang belum
  // pernah dimuat baru bisa setelah precaching PWA (Sprint 5-6)
  await page.goto("/timeline");
  await page.getByRole("button", { name: "Beranda" }).click();
  await expect(page.getByRole("heading", { name: /Hai/ })).toBeVisible();
  await context.setOffline(true);

  await page.getByRole("button", { name: "Catat", exact: true }).click();
  await page.getByRole("button", { name: "🙂 Mood" }).click();
  await page.getByRole("button", { name: "Mood 4 dari 5" }).click();
  await expect(page.getByRole("status")).toContainText("Mood hari ini tercatat");

  // navigasi client-side ke Timeline tetap jalan offline
  await page.getByRole("button", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { name: "Hari ini" })).toBeVisible();
  await expect(page.getByText("Mood 4/5")).toBeVisible();
});
