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
