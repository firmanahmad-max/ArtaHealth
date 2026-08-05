import { test, expect } from "@playwright/test";

test("buat & centang kebiasaan saat OFFLINE — streak menyala dan bertahan setelah reload", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByText("Belum ada kebiasaan")).toBeVisible();

  await context.setOffline(true);

  // buat kebiasaan (default: setiap hari)
  await page.getByRole("button", { name: "+ Tambah Kebiasaan" }).click();
  await page.getByPlaceholder("mis. Minum vitamin").fill("Minum vitamin");
  await page.getByRole("button", { name: "Simpan Kebiasaan" }).click();
  await expect(page.getByText("Minum vitamin")).toBeVisible();
  await expect(page.getByLabel("Streak 0 hari")).toBeVisible();

  // centang → streak 1 + toast undo (checkbox controlled — state menyusul liveQuery)
  await page.getByRole("checkbox").click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(page.getByLabel("Streak 1 hari")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "selesai" })).toBeVisible();

  // online lagi + reload → habit, centang, dan streak pulih dari IndexedDB
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText("Minum vitamin")).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(page.getByLabel("Streak 1 hari")).toBeVisible();
});

test("undo pada toast membatalkan centang kebiasaan", async ({ page, context }) => {
  await page.goto("/");
  await context.setOffline(true);

  await page.getByRole("button", { name: "+ Tambah Kebiasaan" }).click();
  await page.getByPlaceholder("mis. Minum vitamin").fill("Baca 10 menit");
  await page.getByRole("button", { name: "Simpan Kebiasaan" }).click();

  await page.getByRole("checkbox").click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(page.getByLabel("Streak 1 hari")).toBeVisible();
  await page.getByRole("button", { name: "Urungkan" }).click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByLabel("Streak 0 hari")).toBeVisible();
});
