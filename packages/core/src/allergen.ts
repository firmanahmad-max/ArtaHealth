/**
 * Sadar Gizi — deteksi alergen (addendum-sadar-gizi.md §6). DETERMINISTIK.
 * Vision hanya mengekstrak `ingredients_raw` (teks daftar bahan apa adanya);
 * PENCOCOKAN alergen dihitung di sini dari daftar sinonim ber-Bahasa Indonesia +
 * alergen kustom pengguna. Bisa dijelaskan & diaudit — tidak menebak.
 *
 * Prinsip keselamatan:
 *  · Tandai kemungkinan, JANGAN menjamin "bebas alergen" (label bisa tak lengkap /
 *    ada kontaminasi silang). UI wajib memakai bahasa "kemungkinan mengandung".
 *  · Cocokkan pada batas kata untuk menekan positif palsu (mis. "kacang tanah"
 *    ≠ "kacang polong"). Kacang tanah (peanut) DIPISAH dari kacang pohon (tree nut).
 *
 * ⚠️ Daftar sinonim = kerangka; WAJIB ditinjau ahli gizi/alergi sebelum flag nyala.
 */

export type AllergenKey =
  | "milk" | "egg" | "fish" | "shellfish" | "peanut" | "tree_nut"
  | "soy" | "wheat" | "sesame";

export interface AllergenDef {
  key: AllergenKey;
  label: string;
  icon: string;
  /** sinonim (huruf kecil) yang ditandai bila muncul di daftar bahan */
  terms: string[];
}

/** Alergen umum Indonesia + Big-9. terms = kata/frasa yang dicocokkan pada batas kata. */
export const ALLERGEN_DEFS: AllergenDef[] = [
  { key: "milk", label: "Susu", icon: "🥛", terms: ["susu", "milk", "laktosa", "lactose", "whey", "kasein", "casein", "keju", "cheese", "mentega", "butter", "krim", "cream", "yogurt", "yoghurt"] },
  { key: "egg", label: "Telur", icon: "🥚", terms: ["telur", "egg", "albumin", "ovalbumin"] },
  { key: "fish", label: "Ikan", icon: "🐟", terms: ["ikan", "fish", "tuna", "salmon", "teri", "sarden", "sardine", "tongkol"] },
  { key: "shellfish", label: "Udang & Kerang", icon: "🦐", terms: ["udang", "shrimp", "kepiting", "crab", "lobster", "kerang", "cumi", "tiram", "oyster", "krustasea", "krustacea"] },
  { key: "peanut", label: "Kacang Tanah", icon: "🥜", terms: ["kacang tanah", "peanut", "groundnut"] },
  { key: "tree_nut", label: "Kacang Pohon", icon: "🌰", terms: ["almond", "mede", "mete", "kacang mede", "kacang mete", "kenari", "hazelnut", "pistachio", "kacang pohon", "walnut", "pecan", "macadamia"] },
  { key: "soy", label: "Kedelai", icon: "🫘", terms: ["kedelai", "soy", "soya", "soybean", "tahu", "tempe", "kecap", "edamame", "lesitin kedelai", "isolat kedelai"] },
  { key: "wheat", label: "Gandum/Gluten", icon: "🌾", terms: ["gandum", "wheat", "terigu", "gluten", "barley", "jelai", "rye", "gandum hitam"] },
  { key: "sesame", label: "Wijen", icon: "◻️", terms: ["wijen", "sesame", "tahini"] },
];

const DEF_BY_KEY: Record<string, AllergenDef> = Object.fromEntries(ALLERGEN_DEFS.map((d) => [d.key, d]));

/** Satu alergen dari profil pengguna yang ingin dipantau. custom → terms manual. */
export interface SelectedAllergen {
  key: string;            // AllergenKey standar, atau slug kustom
  label?: string;         // wajib bila kustom
  terms?: string[];       // sinonim tambahan (kustom); huruf kecil
  custom?: boolean;
}

export interface AllergenMatch {
  key: string;
  label: string;
  icon: string;
  /** teks bahan yang memicu kecocokan (untuk transparansi) */
  matchedTerm: string;
  custom: boolean;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Cocok bila `term` muncul sebagai kata utuh (batas non-alfanumerik) di `haystack`. */
function containsTerm(haystack: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(t)}([^a-z0-9]|$)`, "i");
  return re.test(haystack);
}

/** Normalisasi ringan: huruf kecil + rapikan spasi (diakritik jarang di label ID). */
function normalize(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ");
}

/**
 * Deteksi alergen yang dipantau pada teks daftar bahan.
 * Mengembalikan satu match per alergen (istilah pertama yang cocok), terurut
 * sesuai daftar `selected`. Tidak pernah mengklaim "aman" — hanya menandai temuan.
 */
export function detectAllergens(ingredientsRaw: string, selected: SelectedAllergen[]): AllergenMatch[] {
  const hay = normalize(ingredientsRaw ?? "");
  if (!hay) return [];
  const out: AllergenMatch[] = [];
  const seen = new Set<string>();
  for (const sel of selected) {
    if (seen.has(sel.key)) continue;
    const def = sel.custom ? undefined : DEF_BY_KEY[sel.key];
    const label = sel.label ?? def?.label ?? sel.key;
    const icon = def?.icon ?? "⚠️";
    const terms = [...(def?.terms ?? []), ...(sel.terms ?? []), ...(sel.custom && sel.label ? [sel.label] : [])];
    for (const term of terms) {
      if (containsTerm(hay, term)) {
        out.push({ key: sel.key, label, icon, matchedTerm: term, custom: !!sel.custom });
        seen.add(sel.key);
        break;
      }
    }
  }
  return out;
}
