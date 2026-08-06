"use client";
import { useEffect, useState } from "react";

/**
 * false saat SSR + render client pertama, true setelah mount.
 * Untuk menggate nilai bergantung-waktu/lokal (jam, tanggal) agar HTML statis
 * (di-generate saat build) tidak berbeda dengan render client → cegah hydration
 * mismatch (React #418/#423/#425) yang bisa merusak interaktivitas halaman.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
