/**
 * Verifikasi imsakiyah (Fase 9 · RW-3) — pembanding DETERMINISTIK antara waktu APP (computePrayerTimes,
 * metode Kemenag) dan jadwal RESMI KEMENAG untuk musim tertentu (mis. Ramadan 2027). Gerbang Fase 3
 * §10: seluruh selisih harus ≤ ±2 menit. MURNI (tanpa I/O) → teruji. Dipakai saat Firman menempelkan
 * jadwal Kemenag resmi lalu menjalankan diff. Tidak mengambil data; hanya membandingkan.
 */

export interface ImsakiyahCompareRow {
  label: string;        // konteks baris, mis. "Jakarta · 2027-02-18 · imsak"
  appMinutes: number;   // waktu app (menit sejak tengah malam lokal)
  refMinutes: number;   // waktu referensi Kemenag (menit sejak tengah malam lokal)
}

export interface ImsakiyahCompareEntry extends ImsakiyahCompareRow {
  deltaMin: number;        // appMinutes − refMinutes (bertanda)
  withinTolerance: boolean;
}

export interface ImsakiyahCompareResult {
  toleranceMin: number;
  rows: ImsakiyahCompareEntry[];
  maxAbsDelta: number;     // selisih absolut terbesar
  mismatches: number;      // jumlah baris di luar toleransi
  allWithin: boolean;      // LULUS gerbang bila true
}

/** "HH:MM" → menit sejak tengah malam, atau null bila format tak valid. Memudahkan tempel jadwal. */
export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Bandingkan waktu app vs referensi Kemenag. Toleransi default ±2 menit (gerbang §10).
 * `allWithin` = true → semua baris lolos. Nilai non-finite dianggap mismatch.
 */
export function compareImsakiyah(rows: ImsakiyahCompareRow[], toleranceMin = 2): ImsakiyahCompareResult {
  const out: ImsakiyahCompareEntry[] = [];
  let maxAbsDelta = 0, mismatches = 0;
  for (const r of rows) {
    const finite = Number.isFinite(r.appMinutes) && Number.isFinite(r.refMinutes);
    const deltaMin = finite ? r.appMinutes - r.refMinutes : NaN;
    const withinTolerance = finite && Math.abs(deltaMin) <= toleranceMin;
    if (!withinTolerance) mismatches++;
    if (finite) maxAbsDelta = Math.max(maxAbsDelta, Math.abs(deltaMin));
    out.push({ ...r, deltaMin, withinTolerance });
  }
  return { toleranceMin, rows: out, maxAbsDelta, mismatches, allWithin: mismatches === 0 };
}
