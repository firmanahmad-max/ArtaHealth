/**
 * Food Diary AI — Tabel Komposisi Pangan (Fase 6 #5). Subset hidangan umum Indonesia
 * untuk estimasi gizi DETERMINISTIK: AI mengidentifikasi hidangan + porsi, engine
 * menghitung gizi = per100g × porsi (bukan AI menebak angka). Pola sama Sadar Gizi:
 * AI mengekstrak/identifikasi, engine menilai.
 *
 * ⚠️ ANGKA DI SINI KERANGKA — perkiraan berbasis Tabel Komposisi Pangan Indonesia
 *    (TKPI, Kemenkes) + resep umum. WAJIB diverifikasi ahli gizi vs TKPI resmi sebelum
 *    flag Food Diary dinyalakan (gerbang, pola sama nutrition_bands). Estimasi foto
 *    masakan memang kurang akurat dari label — UI wajib memakai bahasa "perkiraan".
 */

export type FoodCategory =
  | "nasi" | "mie" | "lauk" | "sayur" | "sup" | "kudapan" | "minuman" | "buah" | "roti";

/** Gizi per 100 gram bagian dapat dimakan (TKPI). Natrium mg; sisanya gram/kkal. */
export interface FoodNutrients100g {
  energyKcal: number;
  carbG: number;
  proteinG: number;
  fatG: number;
  satFatG?: number;
  sugarG?: number;
  sodiumMg: number;
  fiberG?: number;
}

export interface FoodItem {
  id: string;
  name: string;
  /** sinonim/variasi ejaan utk pencocokan hasil identifikasi AI (huruf kecil) */
  aliases?: string[];
  category: FoodCategory;
  per100g: FoodNutrients100g;
  /** berat lazim satu porsi (gram) */
  typicalPortionG: number;
  /** label porsi utk UI, mis. "1 piring", "1 mangkuk" */
  portionLabel: string;
}

/**
 * ~50 hidangan umum. Nilai per 100 g (kerangka). Natrium mencakup garam masak lazim.
 * Diurutkan per kategori. Perluasan = tambah entri baru (id unik).
 */
export const FOOD_DB: FoodItem[] = [
  // ===== NASI =====
  f("nasi-putih", "Nasi putih", "nasi", { energyKcal: 130, carbG: 28, proteinG: 2.7, fatG: 0.3, satFatG: 0.1, sugarG: 0.1, sodiumMg: 1, fiberG: 0.4 }, 150, "1 centong", ["nasi"]),
  f("nasi-goreng", "Nasi goreng", "nasi", { energyKcal: 185, carbG: 26, proteinG: 5, fatG: 6.5, satFatG: 1.8, sugarG: 1.5, sodiumMg: 430, fiberG: 0.8 }, 250, "1 piring", ["nasi goreng ayam", "nasgor"]),
  f("nasi-uduk", "Nasi uduk", "nasi", { energyKcal: 190, carbG: 27, proteinG: 3.5, fatG: 7.5, satFatG: 4, sugarG: 0.5, sodiumMg: 320, fiberG: 0.6 }, 200, "1 porsi"),
  f("bubur-ayam", "Bubur ayam", "nasi", { energyKcal: 90, carbG: 14, proteinG: 4, fatG: 2, satFatG: 0.7, sugarG: 0.5, sodiumMg: 350, fiberG: 0.4 }, 300, "1 mangkuk", ["bubur"]),
  f("lontong", "Lontong", "nasi", { energyKcal: 110, carbG: 25, proteinG: 2, fatG: 0.2, sugarG: 0, sodiumMg: 3, fiberG: 0.3 }, 120, "1 buah", ["ketupat"]),

  // ===== MIE =====
  f("mie-goreng", "Mie goreng", "mie", { energyKcal: 200, carbG: 27, proteinG: 5, fatG: 8, satFatG: 3, sugarG: 2, sodiumMg: 560, fiberG: 1 }, 220, "1 piring", ["bakmi goreng", "mi goreng"]),
  f("mie-ayam", "Mie ayam", "mie", { energyKcal: 165, carbG: 24, proteinG: 6, fatG: 5, satFatG: 1.8, sugarG: 1.5, sodiumMg: 620, fiberG: 1 }, 300, "1 mangkuk", ["bakmi ayam"]),
  f("mie-rebus", "Mie rebus", "mie", { energyKcal: 140, carbG: 22, proteinG: 4, fatG: 4, satFatG: 1.5, sugarG: 1.5, sodiumMg: 640, fiberG: 1 }, 300, "1 mangkuk"),
  f("indomie-goreng", "Mi instan goreng", "mie", { energyKcal: 210, carbG: 28, proteinG: 5, fatG: 9, satFatG: 4.5, sugarG: 2.5, sodiumMg: 830, fiberG: 1.2 }, 120, "1 bungkus", ["indomie", "mi instan"]),

  // ===== LAUK =====
  f("ayam-goreng", "Ayam goreng", "lauk", { energyKcal: 250, carbG: 3, proteinG: 22, fatG: 17, satFatG: 4.5, sugarG: 0, sodiumMg: 400, fiberG: 0 }, 100, "1 potong", ["ayam"]),
  f("ayam-bakar", "Ayam bakar", "lauk", { energyKcal: 210, carbG: 5, proteinG: 24, fatG: 11, satFatG: 3, sugarG: 3, sodiumMg: 480, fiberG: 0 }, 100, "1 potong"),
  f("rendang", "Rendang daging", "lauk", { energyKcal: 290, carbG: 6, proteinG: 20, fatG: 21, satFatG: 11, sugarG: 2, sodiumMg: 520, fiberG: 1 }, 80, "1 potong", ["rendang sapi"]),
  f("telur-goreng", "Telur ceplok/dadar", "lauk", { energyKcal: 195, carbG: 1, proteinG: 13, fatG: 15, satFatG: 4, sugarG: 0.5, sodiumMg: 320, fiberG: 0 }, 60, "1 butir", ["telur ceplok", "telur dadar", "telur"]),
  f("telur-balado", "Telur balado", "lauk", { energyKcal: 180, carbG: 5, proteinG: 11, fatG: 13, satFatG: 3.5, sugarG: 2, sodiumMg: 430, fiberG: 0.8 }, 70, "1 butir"),
  f("tempe-goreng", "Tempe goreng", "lauk", { energyKcal: 220, carbG: 12, proteinG: 17, fatG: 12, satFatG: 2.5, sugarG: 1, sodiumMg: 250, fiberG: 2 }, 50, "2 potong", ["tempe"]),
  f("tahu-goreng", "Tahu goreng", "lauk", { energyKcal: 160, carbG: 6, proteinG: 12, fatG: 10, satFatG: 1.8, sugarG: 0.5, sodiumMg: 240, fiberG: 1 }, 60, "2 potong", ["tahu"]),
  f("ikan-goreng", "Ikan goreng", "lauk", { energyKcal: 200, carbG: 2, proteinG: 24, fatG: 11, satFatG: 2.5, sugarG: 0, sodiumMg: 350, fiberG: 0 }, 100, "1 ekor", ["ikan"]),
  f("sate-ayam", "Sate ayam", "lauk", { energyKcal: 225, carbG: 8, proteinG: 20, fatG: 12, satFatG: 3, sugarG: 5, sodiumMg: 520, fiberG: 1 }, 120, "10 tusuk", ["sate"]),
  f("ikan-bakar", "Ikan bakar", "lauk", { energyKcal: 160, carbG: 3, proteinG: 26, fatG: 5, satFatG: 1.5, sugarG: 2, sodiumMg: 420, fiberG: 0 }, 120, "1 ekor"),

  // ===== SAYUR =====
  f("gado-gado", "Gado-gado", "sayur", { energyKcal: 140, carbG: 12, proteinG: 6, fatG: 8, satFatG: 2, sugarG: 4, sodiumMg: 380, fiberG: 3 }, 250, "1 porsi"),
  f("sayur-asem", "Sayur asem", "sayur", { energyKcal: 45, carbG: 8, proteinG: 2, fatG: 0.5, sugarG: 3, sodiumMg: 380, fiberG: 2.5 }, 200, "1 mangkuk"),
  f("capcay", "Capcay", "sayur", { energyKcal: 75, carbG: 8, proteinG: 3, fatG: 4, satFatG: 1, sugarG: 3, sodiumMg: 420, fiberG: 2.5 }, 200, "1 porsi"),
  f("urap", "Urap sayur", "sayur", { energyKcal: 110, carbG: 9, proteinG: 4, fatG: 7, satFatG: 4, sugarG: 3, sodiumMg: 300, fiberG: 3.5 }, 150, "1 porsi"),
  f("tumis-kangkung", "Tumis kangkung", "sayur", { energyKcal: 70, carbG: 6, proteinG: 3, fatG: 4, satFatG: 1, sugarG: 2, sodiumMg: 400, fiberG: 2.5 }, 150, "1 porsi", ["cah kangkung"]),

  // ===== SUP =====
  f("soto-ayam", "Soto ayam", "sup", { energyKcal: 60, carbG: 5, proteinG: 5, fatG: 2.5, satFatG: 1, sugarG: 1, sodiumMg: 520, fiberG: 0.5 }, 350, "1 mangkuk", ["soto"]),
  f("bakso", "Bakso", "sup", { energyKcal: 100, carbG: 10, proteinG: 6, fatG: 4, satFatG: 1.8, sugarG: 1, sodiumMg: 650, fiberG: 0.5 }, 300, "1 mangkuk", ["bakso kuah"]),
  f("sop-ayam", "Sop ayam", "sup", { energyKcal: 55, carbG: 5, proteinG: 5, fatG: 2, satFatG: 0.7, sugarG: 2, sodiumMg: 450, fiberG: 1 }, 300, "1 mangkuk", ["sop"]),
  f("rawon", "Rawon", "sup", { energyKcal: 95, carbG: 5, proteinG: 8, fatG: 5, satFatG: 2, sugarG: 1, sodiumMg: 560, fiberG: 0.6 }, 300, "1 mangkuk"),

  // ===== KUDAPAN =====
  f("bakwan", "Bakwan/gorengan", "kudapan", { energyKcal: 280, carbG: 30, proteinG: 4, fatG: 16, satFatG: 5, sugarG: 1, sodiumMg: 300, fiberG: 1.5 }, 50, "1 buah", ["gorengan", "bala-bala"]),
  f("pisang-goreng", "Pisang goreng", "kudapan", { energyKcal: 240, carbG: 35, proteinG: 2, fatG: 10, satFatG: 3.5, sugarG: 15, sodiumMg: 90, fiberG: 2 }, 60, "1 buah"),
  f("tahu-isi", "Tahu isi", "kudapan", { energyKcal: 200, carbG: 18, proteinG: 7, fatG: 11, satFatG: 3, sugarG: 1, sodiumMg: 320, fiberG: 1.5 }, 60, "1 buah"),
  f("martabak-manis", "Martabak manis", "kudapan", { energyKcal: 350, carbG: 45, proteinG: 6, fatG: 16, satFatG: 8, sugarG: 22, sodiumMg: 250, fiberG: 1 }, 100, "1 potong", ["terang bulan"]),
  f("donat", "Donat", "kudapan", { energyKcal: 380, carbG: 45, proteinG: 6, fatG: 20, satFatG: 8, sugarG: 18, sodiumMg: 320, fiberG: 1.5 }, 60, "1 buah"),
  f("risoles", "Risoles", "kudapan", { energyKcal: 260, carbG: 25, proteinG: 6, fatG: 15, satFatG: 4, sugarG: 2, sodiumMg: 340, fiberG: 1 }, 50, "1 buah"),
  f("keripik", "Keripik singkong/kentang", "kudapan", { energyKcal: 520, carbG: 55, proteinG: 5, fatG: 32, satFatG: 12, sugarG: 2, sodiumMg: 480, fiberG: 3 }, 30, "1 bungkus kecil", ["keripik"]),
  f("biskuit", "Biskuit", "kudapan", { energyKcal: 460, carbG: 68, proteinG: 6, fatG: 18, satFatG: 9, sugarG: 24, sodiumMg: 400, fiberG: 2 }, 30, "3-4 keping"),

  // ===== MINUMAN =====
  f("es-teh-manis", "Es teh manis", "minuman", { energyKcal: 35, carbG: 9, proteinG: 0, fatG: 0, sugarG: 9, sodiumMg: 5, fiberG: 0 }, 250, "1 gelas", ["teh manis", "es teh"]),
  f("kopi-susu", "Kopi susu", "minuman", { energyKcal: 70, carbG: 11, proteinG: 1.5, fatG: 2, satFatG: 1.2, sugarG: 10, sodiumMg: 25, fiberG: 0 }, 250, "1 gelas", ["es kopi susu", "kopi"]),
  f("teh-tawar", "Teh tawar", "minuman", { energyKcal: 1, carbG: 0.3, proteinG: 0, fatG: 0, sugarG: 0, sodiumMg: 3, fiberG: 0 }, 250, "1 gelas"),
  f("jus-jeruk", "Jus jeruk", "minuman", { energyKcal: 45, carbG: 10, proteinG: 0.7, fatG: 0.2, sugarG: 8, sodiumMg: 2, fiberG: 0.3 }, 250, "1 gelas", ["jus"]),
  f("es-jeruk", "Es jeruk", "minuman", { energyKcal: 50, carbG: 12, proteinG: 0.5, fatG: 0, sugarG: 11, sodiumMg: 3, fiberG: 0.2 }, 250, "1 gelas"),
  f("susu", "Susu", "minuman", { energyKcal: 62, carbG: 5, proteinG: 3.2, fatG: 3.4, satFatG: 2, sugarG: 5, sodiumMg: 44, fiberG: 0 }, 200, "1 gelas", ["susu sapi"]),

  // ===== BUAH =====
  f("pisang", "Pisang", "buah", { energyKcal: 90, carbG: 23, proteinG: 1.1, fatG: 0.3, sugarG: 12, sodiumMg: 1, fiberG: 2.6 }, 100, "1 buah"),
  f("pepaya", "Pepaya", "buah", { energyKcal: 43, carbG: 11, proteinG: 0.5, fatG: 0.3, sugarG: 8, sodiumMg: 3, fiberG: 1.7 }, 150, "1 potong"),
  f("apel", "Apel", "buah", { energyKcal: 52, carbG: 14, proteinG: 0.3, fatG: 0.2, sugarG: 10, sodiumMg: 1, fiberG: 2.4 }, 150, "1 buah"),
  f("semangka", "Semangka", "buah", { energyKcal: 30, carbG: 8, proteinG: 0.6, fatG: 0.2, sugarG: 6, sodiumMg: 1, fiberG: 0.4 }, 200, "1 potong"),
  f("jeruk", "Jeruk", "buah", { energyKcal: 47, carbG: 12, proteinG: 0.9, fatG: 0.1, sugarG: 9, sodiumMg: 0, fiberG: 2.4 }, 100, "1 buah"),

  // ===== ROTI =====
  f("roti-tawar", "Roti tawar", "roti", { energyKcal: 265, carbG: 49, proteinG: 9, fatG: 3.2, satFatG: 0.7, sugarG: 5, sodiumMg: 490, fiberG: 2.7 }, 30, "1 lembar", ["roti"]),
  f("roti-manis", "Roti manis (isi)", "roti", { energyKcal: 310, carbG: 50, proteinG: 7, fatG: 9, satFatG: 4, sugarG: 16, sodiumMg: 320, fiberG: 1.5 }, 70, "1 buah"),
];

function f(
  id: string, name: string, category: FoodCategory, per100g: FoodNutrients100g,
  typicalPortionG: number, portionLabel: string, aliases?: string[],
): FoodItem {
  return { id, name, category, per100g, typicalPortionG, portionLabel, aliases };
}
