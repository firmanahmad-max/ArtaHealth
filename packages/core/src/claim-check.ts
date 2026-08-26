/**
 * Cek Klaim — penilaian AI BERPAGAR (V3-4 · CK-2). Kontrak output + sumber terkurasi.
 * Hanya klaim yang LOLOS gerbang deterministik (claim-safety `allow_ai`) yang dinilai AI.
 * Output WAJIB tervalidasi Zod; gagal → fallback template. Non-vonis mutlak, non-medis:
 * "stance" = tingkat dukungan bukti + selalu arahkan ke sumber resmi & tenaga kesehatan.
 */

import { z } from "zod";

/** Sikap terhadap klaim (bukan "benar/salah" mutlak). */
export const CLAIM_STANCES = [
  "didukung",                        // sejalan dengan anjuran resmi / bukti kuat
  "belum-cukup-bukti",               // klaim belum didukung bukti memadai
  "bertentangan-dengan-anjuran-resmi", // berlawanan dengan pedoman resmi
  "perlu-verifikasi",                // tak bisa dipastikan; verifikasi ke sumber resmi
] as const;
export type ClaimStance = (typeof CLAIM_STANCES)[number];

export const STANCE_LABEL: Record<ClaimStance, string> = {
  "didukung": "Sejalan dengan anjuran resmi",
  "belum-cukup-bukti": "Belum cukup bukti",
  "bertentangan-dengan-anjuran-resmi": "Bertentangan dengan anjuran resmi",
  "perlu-verifikasi": "Perlu verifikasi",
};

/** Warna zona untuk UI (hijau/kuning/merah/abu) — dipetakan di klien. */
export const STANCE_TONE: Record<ClaimStance, "good" | "warn" | "bad" | "neutral"> = {
  "didukung": "good",
  "belum-cukup-bukti": "warn",
  "bertentangan-dengan-anjuran-resmi": "bad",
  "perlu-verifikasi": "neutral",
};

export interface ClaimSource { label: string; url?: string; }

/** Daftar putih sumber resmi (kurasi — bagian gerbang konten). AI diarahkan hanya merujuk ini. */
export const CURATED_SOURCES: ClaimSource[] = [
  { label: "Kemenkes RI", url: "https://www.kemkes.go.id" },
  { label: "WHO", url: "https://www.who.int" },
  { label: "BPOM RI", url: "https://www.pom.go.id" },
  { label: "IDAI (Ikatan Dokter Anak Indonesia)", url: "https://www.idai.or.id" },
  { label: "PERKENI (diabetes)", url: "https://pbperkeni.or.id" },
  { label: "InfoPOM / cek BPOM", url: "https://cekbpom.pom.go.id" },
];

/** Skema output AI (robust): stance wajib & valid; sisanya toleran. */
export const claimAssessmentSchema = z.object({
  stance: z.enum(CLAIM_STANCES),
  ringkasan: z.string().min(1),
  sumber: z.array(z.object({
    label: z.string().min(1),
    url: z.string().optional(),
  })).default([]),
  catatan_keamanan: z.string().optional(),
});
export type ClaimAssessment = z.infer<typeof claimAssessmentSchema>;

/** Disclaimer permanen untuk hasil Cek Klaim. */
export const CLAIM_CHECK_DISCLAIMER =
  "Penilaian ini bantuan memilah informasi, bukan vonis mutlak & bukan nasihat medis. " +
  "Untuk keputusan kesehatan pribadi, rujuk sumber resmi & konsultasikan dengan tenaga kesehatan.";

// ===== CK-3: deteksi niat "verifikasi klaim" di chat (sinergi ArtaBot) =====

const CLAIM_QUESTION_CUES = [
  "benarkah", "betulkah", "apakah benar", "apa benar", "apa betul", "bener nggak", "bener ngga",
  "bener gak", "bener ga", "benar nggak", "benar gak", "valid nggak", "valid gak",
  "hoaks", "hoax", "mitos atau fakta", "fakta atau mitos", "beneran", "katanya",
];

/** Deteksi DETERMINISTIK apakah pesan pengguna terdengar seperti minta verifikasi klaim
 *  ("benarkah…", "hoaks?", "mitos atau fakta"). Dipakai chat untuk menawarkan Cek Klaim. */
export function detectClaimQuestion(text: string): boolean {
  const norm = ` ${(text ?? "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").replace(/\s+/g, " ").trim()} `;
  return CLAIM_QUESTION_CUES.some((c) => norm.includes(c.includes(" ") ? c : ` ${c} `));
}

/** Fallback deterministik saat AI gagal/tak valid — tak pernah menebak vonis. */
export function fallbackAssessment(): ClaimAssessment {
  return {
    stance: "perlu-verifikasi",
    ringkasan: "Kami belum bisa memeriksa klaim ini sekarang. Sebaiknya verifikasi ke sumber resmi.",
    sumber: CURATED_SOURCES.slice(0, 3),
    catatan_keamanan: "Jangan mengambil keputusan medis hanya dari klaim yang beredar.",
  };
}
