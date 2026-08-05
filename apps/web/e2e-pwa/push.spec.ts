import { test, expect, type Page } from "@playwright/test";

/**
 * Handler push di service worker (CONTEXT §6 + ui-ux-spec §6 poin 5).
 * Event push dikirim SUNGGUHAN lewat CDP (bukan memanggil showNotification
 * langsung), lalu diverifikasi via pesan `push-shown` yang disiarkan SW ke
 * client — jauh lebih andal daripada getNotifications() di Chromium headless.
 */

async function deliverPush(page: Page, payload: object) {
  const client = await page.context().newCDPSession(page);
  await client.send("ServiceWorker.enable");
  let registrationId = "0";
  client.on("ServiceWorker.workerRegistrationUpdated", (event: { registrations: { registrationId: string; scopeURL: string }[] }) => {
    const reg = event.registrations.find((r) => r.scopeURL.includes("localhost:3200"));
    if (reg) registrationId = reg.registrationId;
  });
  await page.waitForTimeout(800);
  await client.send("ServiceWorker.deliverPushMessage" as never, {
    origin: "http://localhost:3200",
    registrationId,
    data: JSON.stringify(payload),
  } as never);
}

const shown = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pushMsgs: { title: string; body: string; kind?: string }[] }).__pushMsgs);

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(["notifications"], { origin: "http://localhost:3200" });
  await page.goto("/");
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 30_000 });
  await page.evaluate(() => {
    (window as unknown as { __pushMsgs: unknown[] }).__pushMsgs = [];
    navigator.serviceWorker.addEventListener("message", (e) => {
      if ((e.data as { type?: string })?.type === "push-shown") {
        (window as unknown as { __pushMsgs: unknown[] }).__pushMsgs.push(e.data);
      }
    });
  });
});

test("push dengan isi personal disampaikan apa adanya dari server", async ({ page }) => {
  await deliverPush(page, {
    title: "Tinggal sedikit lagi 💧",
    body: "Kurang 0,7 liter menuju target air Anda hari ini (1,8 dari 2,5 liter).",
    url: "/",
    kind: "hydration",
  });

  await expect.poll(() => shown(page)).toEqual([
    expect.objectContaining({
      title: "Tinggal sedikit lagi 💧",
      body: expect.stringContaining("0,7 liter"),
      kind: "hydration",
    }),
  ]);
});

test("payload tanpa judul atau isi diabaikan — tidak pernah ada notifikasi kosong", async ({ page }) => {
  await deliverPush(page, { url: "/" });
  await deliverPush(page, { title: "Halo" });                 // tanpa body
  await deliverPush(page, { body: "tanpa judul", url: "/" });  // tanpa title

  await page.waitForTimeout(1200);
  expect(await shown(page)).toEqual([]);
});
