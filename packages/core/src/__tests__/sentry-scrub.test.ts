import { describe, it, expect } from "vitest";
import { scrubBreadcrumb, scrubEvent } from "../sentry-scrub";

describe("scrubBreadcrumb — data kesehatan tidak pernah jadi jejak", () => {
  it("membuang breadcrumb fetch ke Supabase REST & Edge Function", () => {
    expect(scrubBreadcrumb({ category: "fetch", data: { url: "https://x.supabase.co/rest/v1/hydration_logs?volume_ml=eq.250" } })).toBeNull();
    expect(scrubBreadcrumb({ category: "fetch", data: { url: "https://x.supabase.co/functions/v1/ai-gateway" } })).toBeNull();
    expect(scrubBreadcrumb({ category: "xhr", data: { url: "https://abc.supabase.co/rest/v1/mood_logs" } })).toBeNull();
  });

  it("membuang breadcrumb konsol (bisa berisi object log kesehatan)", () => {
    expect(scrubBreadcrumb({ category: "console", data: { arguments: ["mood", 4] } })).toBeNull();
  });

  it("menyaring body request/response dari fetch non-kesehatan, tapi tetap dikirim", () => {
    const b = scrubBreadcrumb({
      category: "fetch",
      data: { url: "https://cdn.example.com/font.woff2", request_body: "x", response_body: "y", status_code: 200 },
    });
    expect(b).not.toBeNull();
    expect(b!.data).not.toHaveProperty("request_body");
    expect(b!.data).not.toHaveProperty("response_body");
    expect(b!.data!.status_code).toBe(200);
  });

  it("breadcrumb UI biasa (klik/navigasi) diloloskan apa adanya", () => {
    const nav = { category: "navigation", data: { from: "/", to: "/timeline" } };
    expect(scrubBreadcrumb(nav)).toEqual(nav);
  });
});

describe("scrubEvent — event tidak membawa muatan sensitif", () => {
  it("menghapus data, cookies, headers request dan identitas user", () => {
    // variabel dulu: excess-property check hanya menyala pada literal langsung,
    // sedangkan Event Sentry nyata memang punya banyak field ekstra
    const input = {
      request: { url: "/", data: { volumeMl: 250 }, cookies: "sb=...", headers: { authorization: "Bearer x" } },
      user: { id: "profile-uuid", email: "a@b.com" },
      message: "boom",
    };
    const e = scrubEvent(input);
    expect(e.request).not.toHaveProperty("data");
    expect(e.request).not.toHaveProperty("cookies");
    expect(e.request).not.toHaveProperty("headers");
    expect(e.request!.url).toBe("/"); // metadata non-sensitif dipertahankan
    expect(e.user).toBeUndefined();
    expect(e.message).toBe("boom"); // pesan error tetap ada untuk debugging
  });

  it("aman untuk event tanpa request/user", () => {
    const input = { request: undefined, user: undefined, message: "x" };
    const e = scrubEvent(input);
    expect(e.message).toBe("x"); // pesan error dipertahankan
    expect(e.user).toBeUndefined();
  });
});
