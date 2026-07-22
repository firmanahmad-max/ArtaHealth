/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, NetworkFirst } from "serwist";

/**
 * Service worker ArtaHealth (CONTEXT §6 — PWA polish).
 * Tujuan utama: aplikasi tetap terbuka & bisa mencatat tanpa jaringan.
 * Data TIDAK di-cache di sini — sumber kebenaran offline adalah IndexedDB
 * (lihat lib/db.ts); SW hanya menangani app shell & aset.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Panggilan Supabase & AI tidak pernah dilayani dari cache — data kesehatan
    // basi lebih berbahaya daripada tidak ada data (UI sudah punya state offline).
    {
      matcher: ({ url }) => url.pathname.startsWith("/rest/v1") || url.pathname.startsWith("/functions/v1"),
      handler: new NetworkOnly(),
    },
    // Navigasi dokumen butuh handler eksplisit: tanpa ini request navigasi ke
    // route di luar precache langsung gagal (ERR_FAILED) dan fallback /offline
    // tidak pernah terpanggil.
    {
      matcher: ({ request, url }) =>
        request.mode === "navigate" && url.origin === self.location.origin,
      handler: new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 3 }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// skipWaiting + clientsClaim di atas sudah memasang perilaku aktivasi langsung
serwist.addEventListeners();

/**
 * Push notification (CONTEXT §6). Isi pesan SELALU datang dari server yang sudah
 * menjalankan mesin keputusan deterministik (packages/core/src/notifications.ts) —
 * SW tidak pernah mengarang teks generik sendiri. Payload tanpa judul/isi diabaikan
 * supaya tidak pernah muncul notifikasi kosong.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; url?: string; kind?: string };
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  if (!payload.title || !payload.body) return;

  event.waitUntil(
    (async () => {
      // beri tahu tab yang terbuka lebih dulu — perlakuan foreground tidak boleh
      // bergantung pada berhasilnya showNotification
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) client.postMessage({ type: "push-shown", ...payload });

      await self.registration.showNotification(payload.title!, {
        body: payload.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: payload.kind ?? "arta-reminder", // satu kategori tidak menumpuk
        data: { url: payload.url ?? "/" },
        lang: "id",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // fokuskan tab yang sudah terbuka daripada menumpuk jendela baru
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
