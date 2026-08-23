// ArtaHealth · Edge Function shared — enkripsi snapshot laporan konsultasi (MK-2).
// AES-GCM (Web Crypto) dengan kunci dari secret CONSULTATION_ENC_KEY (base64, 32 byte).
// Plaintext kesehatan (T1) TAK PERNAH tersimpan di DB — hanya ciphertext + iv.

declare const Deno: { env: { get(name: string): string | undefined } };

const b64encode = (b: Uint8Array): string => btoa(String.fromCharCode(...b));
const b64decode = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function importKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("CONSULTATION_ENC_KEY");
  if (!raw) throw new Error("CONSULTATION_ENC_KEY belum dikonfigurasi");
  const keyBytes = b64decode(raw);
  if (keyBytes.length !== 32) throw new Error("CONSULTATION_ENC_KEY harus 32 byte (base64)");
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptJson(obj: unknown): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return { ciphertext: b64encode(ct), iv: b64encode(iv) };
}

export async function decryptJson(ciphertext: string, iv: string): Promise<unknown> {
  const key = await importKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(iv) }, key, b64decode(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
}

/** Token akses acak (48 hex) — kapabilitas publik read-only, tak tertebak. */
export function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
