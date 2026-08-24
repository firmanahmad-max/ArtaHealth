/**
 * Cek Klaim — gerbang keamanan DETERMINISTIK (V3-4 · CK-1). Lapisan pertama sebelum AI:
 * klasifikasi klaim kesehatan + deteksi red-flag lewat kata kunci. Klaim berisiko tinggi
 * (penyembuhan penyakit serius, stop/ganti obat, dosis, anti-vaksin, "obat ajaib") TIDAK
 * diteruskan ke AI untuk dinilai — dikembalikan template eskalasi yang mengarahkan ke
 * sumber resmi & tenaga kesehatan. Non-vonis, non-medis, non-diagnosis (CONTEXT §4).
 *
 * Aman berdiri sendiri (tanpa AI). AI (CK-2) hanya menilai klaim yang lolos gerbang.
 */

export type ClaimCategory = "out_of_domain" | "high_caution" | "reviewable";
export type ClaimAction = "reject_out_of_domain" | "escalate" | "allow_ai";

export interface ClaimRedFlag { kind: string; term: string; }

export interface ClaimSafety {
  category: ClaimCategory;
  action: ClaimAction;
  needsEscalation: boolean;
  redFlags: ClaimRedFlag[];
  message?: string;   // template untuk out_of_domain / escalate
}

// Kata kunci domain kesehatan (klaim harus menyentuh ini agar diproses).
const HEALTH_TERMS = [
  "sehat", "kesehatan", "sakit", "penyakit", "obat", "herbal", "jamu", "vaksin", "imun",
  "diabetes", "gula darah", "kanker", "tumor", "hipertensi", "tekanan darah", "kolesterol",
  "jantung", "stroke", "ginjal", "hiv", "aids", "hepatitis", "tbc", "covid", "virus",
  "diet", "gizi", "vitamin", "suplemen", "terapi", "madu", "detoks", "berat badan", "asam urat",
];

const SERIOUS_DISEASE = ["kanker", "tumor", "diabetes", "hiv", "aids", "gagal ginjal", "stroke", "jantung", "hepatitis", "tbc", "covid"];
const CURE_TERMS = ["sembuh", "menyembuhkan", "sembuh total", "obati total", "membasmi", "memberantas", "mengobati total"];
const MIRACLE_TERMS = ["ajaib", "mukjizat", "seketika", "instan", "100%", "dijamin", "permanen", "tanpa efek samping", "pasti sembuh"];
const MED_STOP_TERMS = ["berhenti obat", "berhenti minum obat", "stop obat", "hentikan obat", "ganti obat", "tanpa obat", "buang obat", "tidak perlu obat"];
const ANTI_VACCINE_TERMS = ["vaksin berbahaya", "vaksin menyebabkan", "vaksin sebabkan", "anti vaksin", "tolak vaksin", "vaksin mengandung", "bahaya vaksin"];
const DOSAGE_TERMS = ["dosis", "takaran"];

/** Normalisasi: huruf kecil, tanda baca → spasi, spasi rangkap dirapikan. */
function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9%]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

/** Cocokkan istilah (frasa via includes; kata tunggal via batas spasi). */
function matchTerms(norm: string, terms: string[]): string[] {
  const hits: string[] = [];
  for (const t of terms) {
    const needle = t.includes(" ") || t.includes("%") ? t.toLowerCase() : ` ${t.toLowerCase()} `;
    if (norm.includes(needle)) hits.push(t);
  }
  return hits;
}

const OUT_OF_DOMAIN_MSG =
  "Cek Klaim hanya untuk klaim seputar kesehatan. Coba tempelkan klaim kesehatan yang ingin diperiksa.";
const ESCALATE_MSG =
  "Klaim ini menyangkut hal berisiko tinggi (mis. penyembuhan penyakit serius, obat, atau vaksin). " +
  "ArtaHealth tidak menilai benar/salah untuk hal seperti ini. Rujuk sumber resmi (Kemenkes, WHO, BPOM) " +
  "dan konsultasikan dengan tenaga kesehatan. Jangan memulai, menghentikan, atau mengganti pengobatan " +
  "tanpa nasihat dokter.";

export interface ClaimSafetyConfig {
  /** minimal panjang teks agar diproses (hindari input kosong). Default 3. */
  minLength: number;
}
export const DEFAULT_CLAIM_SAFETY_CONFIG: ClaimSafetyConfig = { minLength: 3 };

/** Nilai keamanan klaim (deterministik). Menentukan: tolak / eskalasi / boleh dinilai AI. */
export function assessClaimSafety(text: string, config: Partial<ClaimSafetyConfig> = {}): ClaimSafety {
  const cfg = { ...DEFAULT_CLAIM_SAFETY_CONFIG, ...config };
  const norm = normalize(text ?? "");
  const trimmed = norm.trim();

  if (trimmed.length < cfg.minLength || matchTerms(norm, HEALTH_TERMS).length === 0) {
    return { category: "out_of_domain", action: "reject_out_of_domain", needsEscalation: false, redFlags: [], message: OUT_OF_DOMAIN_MSG };
  }

  const redFlags: ClaimRedFlag[] = [];
  const push = (kind: string, terms: string[]) => { for (const t of matchTerms(norm, terms)) redFlags.push({ kind, term: t }); };

  const serious = matchTerms(norm, SERIOUS_DISEASE);
  const cure = matchTerms(norm, CURE_TERMS);
  const miracle = matchTerms(norm, MIRACLE_TERMS);

  // Penyembuhan penyakit serius / klaim "ajaib" pada penyakit serius.
  if (serious.length > 0 && (cure.length > 0 || miracle.length > 0)) {
    for (const t of serious) redFlags.push({ kind: "serious_disease_cure", term: t });
    for (const t of cure) redFlags.push({ kind: "serious_disease_cure", term: t });
  }
  // Klaim "ajaib"/instan/100% (obat mujarab) meski penyakit tak disebut eksplisit.
  if (miracle.length > 0) push("miracle_cure", MIRACLE_TERMS);
  // Menyuruh stop/ganti/tanpa obat.
  push("medication_change", MED_STOP_TERMS);
  // Anti-vaksin.
  push("anti_vaccine", ANTI_VACCINE_TERMS);
  // Nasihat dosis.
  push("dosage", DOSAGE_TERMS);

  if (redFlags.length > 0) {
    return { category: "high_caution", action: "escalate", needsEscalation: true, redFlags, message: ESCALATE_MSG };
  }
  // Klaim kesehatan tanpa red-flag → boleh diteruskan ke penilaian AI berpagar (CK-2).
  return { category: "reviewable", action: "allow_ai", needsEscalation: false, redFlags: [] };
}
