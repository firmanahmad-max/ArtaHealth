"use client";
import { getSupabase } from "./supabase";
import { getActiveProfileId, LOCAL_PROFILE_ID } from "./sync";

/**
 * Web Push standar (VAPID) — bukan Firebase SDK di client.
 * Di Chrome/Android transportnya tetap endpoint FCM, jadi ini "push via FCM"
 * dari sisi pengiriman, tanpa menambah SDK ~80 KB ke bundle dan tanpa mengunci
 * client ke satu vendor. Pengirimannya ada di Edge Function `send-reminders`.
 *
 * Tanpa VAPID key (env kosong) semua fungsi menjadi no-op agar app tetap jalan.
 */

const vapidKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export const pushConfigured = (): boolean => vapidKey().length > 0;

export type PushStatus = "unsupported" | "unconfigured" | "default" | "granted" | "denied";

export function pushStatus(): PushStatus {
  if (!pushSupported()) return "unsupported";
  if (!pushConfigured()) return "unconfigured";
  return Notification.permission as "default" | "granted" | "denied";
}

/**
 * Ada langganan push AKTIF di perangkat ini? Izin "granted" saja tidak cukup —
 * user bisa mengizinkan tanpa pernah subscribe (mis. set izin manual di browser).
 * Pakai getRegistration() (bukan .ready yang menggantung bila SW belum aktif).
 */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported() || !pushConfigured()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    return !!(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/**
 * base64url (VAPID) → BufferSource yang diminta PushManager.
 * Buffer dibuat eksplisit sebagai ArrayBuffer: Uint8Array generik membawa
 * ArrayBufferLike yang tidak diterima tipe applicationServerKey.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

/**
 * Minta izin lalu daftarkan langganan push. Mengembalikan status akhir.
 * Dipanggil dari aksi eksplisit user — tidak pernah otomatis saat load
 * (prompt izin tanpa konteks adalah pola yang buruk & menurunkan opt-in).
 */
export async function enablePush(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (!pushConfigured()) return "unconfigured";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as "default" | "denied";

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBuffer(vapidKey()),
    }));

  await saveSubscription(subscription);
  return "granted";
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const supabase = getSupabase();
  const profileId = await getActiveProfileId();
  if (!supabase || profileId === LOCAL_PROFILE_ID) return;

  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;

  await supabase.from("push_devices").upsert(
    {
      profile_id: profileId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
      revoked_at: null,
    },
    { onConflict: "endpoint" },
  );
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const supabase = getSupabase();
  const profileId = await getActiveProfileId();
  if (!supabase || profileId === LOCAL_PROFILE_ID) return;
  await supabase.from("push_devices").update({ revoked_at: new Date().toISOString() }).eq("endpoint", endpoint);
}
