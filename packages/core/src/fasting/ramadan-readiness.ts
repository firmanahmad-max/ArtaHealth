/**
 * Readiness pra-Ramadan (Fase 9 · RW-2) — hitung countdown H-N + checklist persiapan DETERMINISTIK
 * (lokasi imsakiyah, panduan medis, obat terjadwal) untuk musim yang akan datang. MURNI (tanpa I/O)
 * → teruji. Hanya status + dorongan; AKSI tetap di kartu masing-masing (set lokasi/ack medis/obat).
 * Non-medis. Dipakai oleh kartu readiness yang muncul pasca-aktivasi, sebelum Ramadan mulai.
 */

export interface RamadanReadinessInput {
  daysUntilStart: number;        // hari menuju awal Ramadan (>0 = pra-musim)
  hasLocation: boolean;          // lat/lon tersimpan → imsakiyah akurat
  medicalAcknowledged: boolean;  // panduan medis puasa sudah dibaca (medicalAckAt)
  medicationModuleOn: boolean;   // modul obat aktif → item obat relevan
  hasMedications: boolean;       // ada obat terdaftar (cek konflik jam puasa)
}

export interface ReadinessItem { id: string; label: string; done: boolean }

export interface RamadanReadiness {
  daysUntilStart: number;
  items: ReadinessItem[];
  readyCount: number;
  totalCount: number;
  allReady: boolean;
  headline: string;
}

/**
 * Rakit readiness pra-Ramadan. Item obat hanya disertakan bila modul obat aktif. Headline
 * menyemangati melengkapi sisa langkah; semua siap → sambutan hangat.
 */
export function ramadanReadiness(input: RamadanReadinessInput): RamadanReadiness {
  const items: ReadinessItem[] = [
    { id: "location", label: "Lokasi untuk imsakiyah akurat", done: input.hasLocation },
    { id: "medical", label: "Panduan medis puasa dibaca", done: input.medicalAcknowledged },
  ];
  if (input.medicationModuleOn) {
    items.push({ id: "medication", label: "Obat terjadwal (cek konflik jam puasa)", done: input.hasMedications });
  }

  const readyCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const allReady = readyCount === totalCount;
  const remaining = totalCount - readyCount;

  const headline = allReady
    ? "Semua siap menyambut Ramadan! 🌙"
    : `Lengkapi ${remaining} langkah lagi agar musim puasamu mulus.`;

  return { daysUntilStart: Math.max(0, Math.round(input.daysUntilStart)), items, readyCount, totalCount, allReady, headline };
}
