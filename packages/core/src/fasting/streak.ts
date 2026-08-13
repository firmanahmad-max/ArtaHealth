/**
 * Progres puasa Ramadan (addendum-ramadan §7) — deterministik.
 *
 * Dihitung HANYA dari hari berstatus puasa; hari `not_fasting` TRANSPARAN
 * (bukan pemutus, bukan kecacatan — uzur adalah privasi §2). Default selama
 * Ramadan = puasa (§3.1): tanggal tanpa baris eksplisit dihitung sebagai puasa,
 * hanya `not_fasting` eksplisit yang dikurangi. Ditampilkan sebagai "X/Y hari
 * puasa" (pencapaian), bukan streak yang bisa "putus".
 */

export interface FastingDayEntry {
  date: string; // "YYYY-MM-DD"
  status: "fasting" | "not_fasting";
}

export interface RamadanProgress {
  /** jumlah hari berpuasa (default puasa − not_fasting eksplisit) */
  fasted: number;
  /** jumlah hari berlalu dalam rentang [start, today] */
  elapsed: number;
}

const addDayUTC = (d: Date) => { d.setUTCDate(d.getUTCDate() + 1); return d; };

/**
 * Hitung {fasted, elapsed} dari `startDate` sampai `today` inklusif (kunci tanggal
 * lokal "YYYY-MM-DD"). Pemanggil menjepit `today` ke ramadan_end bila perlu.
 */
export function ramadanFastingProgress(
  entries: FastingDayEntry[], startDate: string, today: string,
): RamadanProgress {
  if (today < startDate) return { fasted: 0, elapsed: 0 };
  const status = new Map(entries.map((e) => [e.date, e.status]));

  let fasted = 0;
  let elapsed = 0;
  for (let cur = new Date(`${startDate}T00:00:00Z`); ; addDayUTC(cur)) {
    const key = cur.toISOString().slice(0, 10);
    if (key > today) break;
    elapsed++;
    if (status.get(key) !== "not_fasting") fasted++; // default puasa; hanya not_fasting eksplisit dikurangi
  }
  return { fasted, elapsed };
}
