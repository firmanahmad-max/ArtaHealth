import { test, expect } from "@playwright/test";

/**
 * Jalur keselamatan AI Chat (blueprint §5.3). Guard berjalan DI CLIENT lebih dulu,
 * jadi panduan darurat harus muncul bahkan tanpa jaringan sama sekali.
 */

test("gejala darurat memicu panduan 119 dan menghentikan analisis", async ({ page }) => {
  await page.goto("/chat");

  await page.getByLabel("Pertanyaan untuk Arta").fill("dada saya nyeri dan sesak napas");
  await page.getByRole("button", { name: "Kirim" }).click();

  await expect(page.getByText("PERLU PENANGANAN SEGERA")).toBeVisible();
  await expect(page.getByText(/Hubungi 119/)).toBeVisible();
  await expect(page.getByText(/berhenti menganalisis/)).toBeVisible();
  // sintaks markdown tidak boleh bocor ke layar saat panik
  await expect(page.getByRole("log")).not.toContainText("**");
});

test("red flag TETAP muncul saat OFFLINE — keselamatan tidak bergantung jaringan", async ({ page, context }) => {
  await page.goto("/chat");
  await context.setOffline(true);

  await page.getByLabel("Pertanyaan untuk Arta").fill("saya ingin mengakhiri hidup");
  await page.getByRole("button", { name: "Kirim" }).click();

  // kasus menyakiti diri punya jalur sendiri: layanan jiwa, bukan ambulans
  await expect(page.getByText(/119 ext\. 8/)).toBeVisible();
  await expect(page.getByText(/tidak sendirian/)).toBeVisible();
});

test("red flag tidak memotong kuota chat gratis", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByText("5/5 pesan")).toBeVisible();

  await page.getByLabel("Pertanyaan untuk Arta").fill("muntah darah sejak tadi");
  await page.getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByText(/Hubungi 119/)).toBeVisible();

  await expect(page.getByText("5/5 pesan")).toBeVisible();
});

test("disclaimer permanen selalu tampil di layar chat", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByText(/bukan pengganti tenaga medis/)).toBeVisible();

  await page.getByLabel("Pertanyaan untuk Arta").fill("tips tidur nyenyak");
  await page.getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByText(/bukan pengganti tenaga medis/)).toBeVisible();
});

test("Daily Insight terisi walau AI tidak tersedia (fallback deterministik)", async ({ page, context }) => {
  await page.goto("/");
  await context.setOffline(true);

  // catat air agar ada bahan insight
  await page.getByRole("button", { name: "Catat", exact: true }).click();
  await page.getByRole("button", { name: /600 ml/ }).click();

  const insight = page.getByLabel("Insight harian");
  await expect(insight).toBeVisible();
  await expect(insight).toContainText("Health Score Anda hari ini");
  await expect(insight).toContainText(/liter air lagi/);
  await expect(insight).toContainText(/bukan pengganti tenaga medis/);
  // desimal Bahasa Indonesia
  await expect(insight).not.toContainText(/\d\.\d liter/);
});
