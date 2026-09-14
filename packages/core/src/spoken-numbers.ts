/**
 * Normalisasi angka terucap Bahasa Indonesia → digit (untuk Voice quick-log & ketikan kata).
 * "minum dua gelas" → "minum 2 gelas"; "jalan tiga ribu langkah" → "jalan 3000 langkah";
 * "berat tujuh puluh kg" → "berat 70 kg". Deterministik. Kata bukan-angka dibiarkan.
 */

const SMALL: Record<string, number> = {
  nol: 0, kosong: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11,
};
const SCALE = new Set(["belas", "puluh", "ratus", "seratus", "ribu", "seribu"]);
const isNumberWord = (w: string): boolean => w in SMALL || SCALE.has(w);

/** Hitung nilai satu rangkaian kata-angka. null bila bukan angka valid. */
function runValue(tokens: string[]): number | null {
  let total = 0, cur = 0, any = false;
  for (const w of tokens) {
    if (w in SMALL) { cur += SMALL[w]!; any = true; }
    else if (w === "belas") { cur = 10 + cur; any = true; }
    else if (w === "puluh") { cur = (cur || 1) * 10; any = true; }
    else if (w === "seratus") { cur += 100; any = true; }
    else if (w === "ratus") { cur = (cur || 1) * 100; any = true; }
    else if (w === "seribu") { total += 1000; cur = 0; any = true; }
    else if (w === "ribu") { total += (cur || 1) * 1000; cur = 0; any = true; }
    else return null;
  }
  return any ? total + cur : null;
}

/** Ganti rangkaian kata-angka dalam teks dengan digit (spasi dirapikan jadi tunggal). */
export function normalizeSpokenNumbers(text: string): string {
  const raw = (text ?? "").trim();
  if (!raw) return text ?? "";
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const v = runValue(run.map((w) => w.toLowerCase()));
    out.push(v != null ? String(v) : run.join(" "));
    run = [];
  };
  for (const word of raw.split(/\s+/)) {
    if (isNumberWord(word.toLowerCase())) run.push(word);
    else { flush(); out.push(word); }
  }
  flush();
  return out.join(" ");
}
