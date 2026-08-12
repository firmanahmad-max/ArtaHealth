/**
 * Safety Guard (technical-blueprint §5.3) — deterministik, dijalankan SEBELUM
 * dan SESUDAH panggilan model. Ini lapisan keselamatan, bukan fitur AI:
 * tidak boleh bergantung pada kepatuhan model.
 *
 * - Input guard: red-flag darurat → template tindakan + 119, AI berhenti menganalisis.
 *   Fase 2: juga menangkap angka biomarker berbahaya di teks (mis. "tensi 190/120",
 *   "GDS 55"); ambang diimpor dari biomarker engine (sumber tunggal).
 * - Output guard: blokir jawaban yang mendiagnosis / menyebut dosis / menyuruh
 *   mulai-berhenti obat → diganti template aman.
 */
import { RED_FLAG_THRESHOLDS, redFlagGuidance } from "../biomarker.ts";

export type RedFlagCategory =
  | "cardiac" | "stroke" | "breathing" | "bleeding" | "self_harm" | "consciousness" | "obstetric"
  | "hypertensive_crisis" | "hypoglycemia" | "hyperglycemic_crisis";

export interface RedFlagHit {
  category: RedFlagCategory;
  /** frasa yang memicu — untuk audit; JANGAN simpan kalimat lengkap user (§5.3) */
  pattern: string;
}

/**
 * Sisipan yang lazim antara bagian tubuh dan gejala: posesif/pronomina dan
 * keterangan pendek — "dada SAYA nyeri", "mulut SAYA mencong", "dada SEBELAH KIRI sakit".
 * Tanpa ini detektor melewatkan bentuk kalimat paling umum dalam bahasa sehari-hari.
 */
const GAP = "(?:\\s+(?:saya|aku|ku|nya|gue|gua|gw|ini|itu|terasa|rasanya|kok|tiba-tiba|mendadak|sebelah|kiri|kanan|bagian|agak|sangat|makin|semakin)){0,3}";

/**
 * Pola darurat Bahasa Indonesia (termasuk ragam informal/singkatan yang lazim).
 * Sengaja over-inclusive: false positive hanya menampilkan pesan hati-hati,
 * false negative bisa berakibat fatal.
 */
const RED_FLAG_PATTERNS: { category: RedFlagCategory; re: RegExp; label: string }[] = [
  { category: "cardiac", re: /\b(nyeri|sakit|nyilu)\s+(di\s+)?dada\b/i, label: "nyeri dada" },
  { category: "cardiac", re: new RegExp(`\\bdada${GAP}\\s+(sakit|nyeri|sesak|berat|tertekan|kayak\\s+ditimpa|seperti\\s+ditimpa)\\b`, "i"), label: "nyeri dada" },
  { category: "cardiac", re: /\bjantung\s+(berdebar\s+(kencang|hebat)|serangan)\b/i, label: "serangan jantung" },
  { category: "breathing", re: /\b(sesak|susah|sulit|nggak bisa|tidak bisa|gak bisa)\s+(napas|nafas|bernapas|bernafas)\b/i, label: "sesak napas" },
  { category: "breathing", re: new RegExp(`\\b(napas|nafas)${GAP}\\s+(berat|pendek|tersengal|sesak)\\b`, "i"), label: "napas berat" },
  { category: "stroke", re: new RegExp(`\\b(wajah|muka|mulut)${GAP}\\s+(mencong|perot|miring|turun\\s+sebelah)\\b`, "i"), label: "wajah mencong" },
  { category: "stroke", re: /\b(lumpuh|lemah|kebas|kesemutan)\s+(sebelah|separuh|satu sisi)\b/i, label: "lemah sebelah" },
  { category: "stroke", re: new RegExp(`\\b(tangan|kaki|badan|tubuh)${GAP}\\s+(lumpuh|lemas\\s+sebelah|lemah\\s+sebelah|tidak\\s+bisa\\s+digerakkan)\\b`, "i"), label: "lemah sebelah" },
  { category: "stroke", re: new RegExp(`\\b(bicara|ngomong|omongan)${GAP}\\s+(pelo|cadel|tidak\\s+jelas|ngaco)\\b`, "i"), label: "bicara pelo" },
  { category: "bleeding", re: /\b(pendarahan|perdarahan)\b/i, label: "pendarahan" },
  { category: "bleeding", re: /\b(muntah|batuk|b\.?a\.?b\.?)\s+darah\b/i, label: "muntah/batuk darah" },
  { category: "bleeding", re: /\bdarah\s+(tidak|nggak|gak)\s+berhenti\b/i, label: "darah tidak berhenti" },
  { category: "consciousness", re: /\b(pingsan|tidak sadar|nggak sadar|gak sadarkan diri|tidak sadarkan diri|kejang)\b/i, label: "penurunan kesadaran" },
  { category: "self_harm", re: /\b(bunuh diri|mengakhiri hidup|akhiri hidup|tidak ingin hidup|ingin mati|pengen mati|menyakiti diri|melukai diri)\b/i, label: "ide menyakiti diri" },
  { category: "obstetric", re: /\bhamil\b.{0,30}\b(pendarahan|perdarahan|kejang|tidak bergerak)\b/i, label: "kedaruratan kehamilan" },
];

export function detectRedFlags(text: string): RedFlagHit[] {
  const hits: RedFlagHit[] = [];
  for (const p of RED_FLAG_PATTERNS) {
    if (p.re.test(text)) hits.push({ category: p.category, pattern: p.label });
  }
  for (const h of detectBiomarkerRedFlags(text)) hits.push(h);
  return hits;
}

/**
 * Biomarker input guard (Fase 2). Menangkap angka BAHAYA yang disebut pengguna
 * di chat sebelum model diminta menganalisis — mis. "tensi 190/120", "GDS 55".
 * Ambang bersumber tunggal dari RED_FLAG_THRESHOLDS di biomarker engine, agar
 * konstanta keselamatan tidak terduplikasi (perubahan satu tempat berlaku semua).
 *
 * Sengaja konservatif: false-positive → sekadar mengarahkan ke 119 (aman),
 * false-negative bisa fatal. Hanya menjadi hit bila engine juga menyatakan red-flag.
 */
export function detectBiomarkerRedFlags(text: string): RedFlagHit[] {
  const hits: RedFlagHit[] = [];
  // 1) Tekanan darah: "tensi 190/120", "TD 180 / 110", "tekanan darah 200 per 130"
  //    Frasa pemicu opsional (angka sendirian tanpa konteks jangan dipicu → false-positive)
  const bpRe = /\b(?:tensi|td|tek(?:anan)?\.?\s*darah|bp)\b[^0-9]{0,20}(\d{2,3})\s*(?:\/|per)\s*(\d{2,3})\b/gi;
  for (const m of text.matchAll(bpRe)) {
    const sys = Number(m[1]); const dia = Number(m[2]);
    if (sys < 40 || sys > 300 || dia < 20 || dia > 200) continue; // buang angka mustahil
    if (sys >= RED_FLAG_THRESHOLDS.bpSystolic || dia >= RED_FLAG_THRESHOLDS.bpDiastolic) {
      hits.push({ category: "hypertensive_crisis", pattern: "krisis hipertensi" });
      break;
    }
  }
  // 2) Gula darah: "gula darah 55", "gds 320 mg/dl", "gula 45", "glukosa 380"
  //    HbA1c (%) tidak akut → sengaja tak dicocokkan.
  const glucoseRe = /\b(?:gula\s+darah|gula|gds|gdp|glukosa|blood\s+sugar)\b[^0-9]{0,20}(\d{2,3})\b(?!\s*%)/gi;
  for (const m of text.matchAll(glucoseRe)) {
    const v = Number(m[1]);
    if (v < 20 || v > 1000) continue;
    if (v < RED_FLAG_THRESHOLDS.glucoseLow) {
      hits.push({ category: "hypoglycemia", pattern: "hipoglikemia" }); break;
    }
    if (v >= RED_FLAG_THRESHOLDS.glucoseHigh) {
      hits.push({ category: "hyperglycemic_crisis", pattern: "krisis hiperglikemia" }); break;
    }
  }
  return hits;
}

/**
 * Pesan darurat — tenang, langkah konkret, nomor darurat Indonesia.
 * Teks polos tanpa markdown: UI merender apa adanya, dan sintaks mentah
 * ("**Hubungi 119**") justru mengganggu keterbacaan saat panik.
 */
export function redFlagResponse(hits: RedFlagHit[]): string {
  const selfHarm = hits.some((h) => h.category === "self_harm");
  if (selfHarm) {
    return [
      "Terima kasih sudah bercerita. Yang Anda rasakan penting dan Anda tidak sendirian.",
      "",
      "Bila ada dorongan menyakiti diri, hubungi 119 ext. 8 (layanan kesehatan jiwa Kemenkes) sekarang, atau ceritakan kepada orang yang Anda percaya dan tetaplah bersama mereka.",
      "Bila keadaan mendesak, ke IGD rumah sakit terdekat.",
      "",
      "Saya di sini untuk hal-hal kebiasaan harian, tetapi untuk yang satu ini Anda layak didampingi manusia yang terlatih.",
    ].join("\n");
  }
  // Hipoglikemia butuh instruksi berbeda ("15 gram gula cepat", bukan 119 saja);
  // reuse redFlagGuidance dari engine agar teks konsisten dengan Risk Panel.
  const hypo = hits.some((h) => h.category === "hypoglycemia");
  if (hypo) {
    const g = redFlagGuidance("hipoglikemia");
    return [
      `${g.title}.`,
      "",
      g.action,
      "",
      "Saya berhenti menganalisis di sini demi keselamatan Anda.",
    ].join("\n");
  }
  return [
    "Gejala atau angka yang Anda sebutkan perlu penanganan medis segera — ini bukan sesuatu yang aman dianalisis aplikasi.",
    "",
    "Hubungi 119 (Ambulans Gawat Darurat) atau pergi ke IGD terdekat sekarang.",
    "Bila memungkinkan, jangan berkendara sendiri dan mintalah seseorang menemani Anda.",
    "",
    "Saya berhenti menganalisis di sini demi keselamatan Anda.",
  ].join("\n");
}

/** Klaim yang tidak boleh keluar dari AI (blueprint §5.3 + CONTEXT §4). */
const UNSAFE_OUTPUT_PATTERNS: RegExp[] = [
  /\banda\s+(menderita|mengidap|terkena|positif)\b/i,          // diagnosis
  /\b(diagnosis|didiagnosis)\s+(anda|nya)\b/i,
  /\b\d+\s?(mg|ml|mcg|gram|g|iu)\b.{0,24}\b(minum|konsumsi|sehari|per hari|dosis|kali sehari)\b/i, // dosis
  /\bdosis\b.{0,24}\b\d+/i,
  /\b(minum|konsumsi|pakai)\s+(obat|antibiotik|paracetamol|amoxicillin|ibuprofen|metformin|amlodipin)\b/i,
  /\b(hentikan|stop|berhenti\s+minum)\s+(obat|terapi|pengobatan)\b/i,
  /\btidak\s+perlu\s+(ke\s+)?dokter\b/i,                        // menahan user dari layanan medis
];

export function isUnsafeOutput(text: string): boolean {
  return UNSAFE_OUTPUT_PATTERNS.some((re) => re.test(text));
}

/** Pengganti aman saat output model diblokir. */
export const SAFE_OUTPUT_FALLBACK =
  "Untuk hal yang menyangkut obat, gejala, atau kondisi medis, sebaiknya dikonfirmasi langsung dengan dokter atau apoteker — mereka bisa menilai kondisi Anda secara utuh. Saya bisa membantu untuk kebiasaan harian seperti tidur, hidrasi, aktivitas, dan mood.";

/** Disclaimer permanen (CONTEXT §4) — dipakai UI chat & insight. */
export const AI_DISCLAIMER =
  "Arta bukan pengganti tenaga medis. Informasi ini bersifat edukasi umum, bukan diagnosis.";
