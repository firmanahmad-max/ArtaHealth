/**
 * ArtaBot quick-log (backlog) — parser DETERMINISTIK niat pencatatan dari teks chat.
 * "minum 2 gelas" / "tidur 7 jam" / "jalan 3000 langkah" / "berat 70 kg" / "mood senang"
 * → intent terstruktur → klien menulis ke log yang ada. Pola tak jelas → null (jatuh ke
 * chat AI biasa). Tak menebak: hanya pola eksplisit yang dicatat.
 */

export type QuickLogKind = "hydration" | "sleep" | "activity" | "weight" | "mood";
export type QuickActivityType = "walk" | "run" | "cycle" | "gym" | "stretch" | "yoga" | "other";

export interface QuickLogIntent {
  kind: QuickLogKind;
  volumeMl?: number;                 // hydration
  sleepMinutes?: number;             // sleep
  activityType?: QuickActivityType;  // activity
  durationMin?: number;              // activity (menit)
  steps?: number;                    // activity (langkah)
  weightKg?: number;                 // weight
  mood?: 1 | 2 | 3 | 4 | 5;          // mood
  label: string;                     // konfirmasi siap-tampil
}

const GLASS_ML = 250, CUP_ML = 150, BOTTLE_ML = 600;
const norm = (t: string): string => ` ${(t ?? "").toLowerCase().replace(/\s+/g, " ").trim()} `;
/** Ambil angka pertama (desimal koma/titik). */
function num(s: string, re: RegExp): number | null {
  const m = s.match(re);
  if (!m) return null;
  const v = parseFloat(m[1]!.replace(",", "."));
  return Number.isFinite(v) ? v : null;
}
const idNum = (n: number): string => n.toLocaleString("id-ID");

const MOOD_WORDS: Record<string, 1 | 2 | 3 | 4 | 5> = {
  "sangat baik": 5, "senang": 5, "bahagia": 5, "gembira": 5,
  "baik": 4, "cukup baik": 4,
  "biasa": 3, "netral": 3, "b aja": 3,
  "kurang": 2, "sedih": 2, "lelah": 2, "capek": 2,
  "buruk": 1, "sangat buruk": 1, "terpuruk": 1, "stres": 1,
};

/** Parse niat pencatatan cepat. null bila tak ada pola jelas. */
export function parseQuickLog(text: string): QuickLogIntent | null {
  const s = norm(text);

  // ── Hidrasi: "minum/air ... gelas|botol|cangkir|ml|liter"
  if (/\b(minum|air|hidrasi)\b/.test(s)) {
    const liter = num(s, /(\d+(?:[.,]\d+)?)\s*(?:liter|l)\b/);
    const ml = num(s, /(\d+(?:[.,]\d+)?)\s*ml\b/);
    const gelas = num(s, /(\d+(?:[.,]\d+)?)\s*gelas\b/);
    const botol = num(s, /(\d+(?:[.,]\d+)?)\s*botol\b/);
    const cangkir = num(s, /(\d+(?:[.,]\d+)?)\s*cangkir\b/);
    let vol: number | null = null;
    if (ml != null) vol = ml;
    else if (liter != null) vol = liter * 1000;
    else if (gelas != null) vol = gelas * GLASS_ML;
    else if (botol != null) vol = botol * BOTTLE_ML;
    else if (cangkir != null) vol = cangkir * CUP_ML;
    if (vol != null && vol > 0) {
      return { kind: "hydration", volumeMl: Math.round(vol), label: `Minum ${idNum(Math.round(vol))} ml` };
    }
  }

  // ── Tidur: "tidur X jam [Y menit]"
  if (/\btidur\b/.test(s)) {
    const jam = num(s, /(\d+(?:[.,]\d+)?)\s*(?:jam|j)\b/);
    const menit = num(s, /(\d+)\s*(?:menit|mnt|m)\b/);
    if (jam != null || menit != null) {
      const total = Math.round((jam ?? 0) * 60 + (menit ?? 0));
      if (total > 0 && total < 24 * 60) {
        const hh = Math.floor(total / 60), mm = total % 60;
        return { kind: "sleep", sleepMinutes: total, label: `Tidur ${hh} jam${mm ? ` ${mm} mnt` : ""}` };
      }
    }
  }

  // ── Aktivitas langkah: "... N langkah" (pemisah ribuan titik/koma dibuang)
  const langkahM = s.match(/(\d[\d.,]*)\s*langkah\b/);
  if (langkahM) {
    const steps = parseInt(langkahM[1]!.replace(/[.,]/g, ""), 10);
    if (Number.isFinite(steps) && steps > 0) {
      return { kind: "activity", activityType: "walk", steps, label: `Jalan ${idNum(steps)} langkah` };
    }
  }

  // ── Aktivitas durasi: "lari/jalan/olahraga/gym/yoga/sepeda N menit"
  const menitOlahraga = num(s, /(\d+)\s*(?:menit|mnt)\b/);
  if (menitOlahraga != null && menitOlahraga > 0 && /\b(olahraga|lari|jalan|gym|yoga|sepeda|jogging|senam|renang|peregangan|stretching)\b/.test(s)) {
    const type: QuickActivityType =
      /\blari|jogging\b/.test(s) ? "run" :
      /\bsepeda\b/.test(s) ? "cycle" :
      /\bgym|senam\b/.test(s) ? "gym" :
      /\byoga\b/.test(s) ? "yoga" :
      /\bperegangan|stretching\b/.test(s) ? "stretch" :
      /\bjalan\b/.test(s) ? "walk" : "other";
    return { kind: "activity", activityType: type, durationMin: Math.round(menitOlahraga), label: `Olahraga ${Math.round(menitOlahraga)} menit` };
  }

  // ── Berat: "berat [badan] X kg"
  if (/\bberat\b/.test(s)) {
    const kg = num(s, /(\d+(?:[.,]\d+)?)\s*(?:kg|kilo|kilogram)\b/);
    if (kg != null && kg > 0 && kg < 400) {
      return { kind: "weight", weightKg: kg, label: `Berat ${idNum(kg)} kg` };
    }
  }

  // ── Mood: "mood N" atau "mood <kata>"
  if (/\bmood\b|\bperasaan\b/.test(s)) {
    const n = num(s, /\bmood\s*(\d)\b/);
    if (n != null && n >= 1 && n <= 5) {
      return { kind: "mood", mood: n as 1 | 2 | 3 | 4 | 5, label: `Mood: ${n}/5` };
    }
    for (const [word, val] of Object.entries(MOOD_WORDS)) {
      if (s.includes(` ${word} `) || s.includes(`mood ${word}`)) {
        return { kind: "mood", mood: val, label: `Mood: ${word}` };
      }
    }
  }

  return null;
}
