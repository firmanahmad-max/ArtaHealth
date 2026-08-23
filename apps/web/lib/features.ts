/**
 * Feature flags build-time (Fase 2+). Default OFF: fitur biomarker TIDAK tampil
 * ke pengguna sampai env di-set — jaminan paling kuat bahwa ambang klinis yang
 * belum direview dokter (addendum §5, CONTEXT §4) tak bocor ke produksi.
 *
 * Dev/staging: set NEXT_PUBLIC_FEATURE_BIOMARKER=1 di .env.local.
 * Produksi (Vercel): biarkan kosong sampai review medis selesai.
 */
export const featureBiomarker = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_BIOMARKER === "1";

/**
 * V2 biomarker (lipid & asam urat) — flag TERPISAH. Ambang V2 butuh review dokter
 * tersendiri, jadi kodenya boleh masuk produksi (di-merge) tanpa tampil sampai
 * flag ini di-set. V2 adalah perluasan V1: mensyaratkan featureBiomarker() juga aktif.
 */
export const featureBiomarkerV2 = (): boolean =>
  featureBiomarker() && process.env.NEXT_PUBLIC_FEATURE_BIOMARKER_V2 === "1";

/**
 * Mode Ramadan (Fase 3). Default OFF: fitur puasa tak tampil sampai akurasi
 * imsakiyah divalidasi vs Kemenag (±2 mnt) & konten medis/keislaman direview
 * (addendum-ramadan §10). Dev: set NEXT_PUBLIC_FEATURE_RAMADAN=1 di .env.local.
 */
export const featureRamadan = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_RAMADAN === "1";

/**
 * Modul obat / Medicine Reminder (Fase 3). Default OFF. Flag sendiri karena modul
 * terpisah; deteksi konflik jadwal obat vs jam puasa aktif hanya bila Mode Ramadan
 * juga menyala. Dev: set NEXT_PUBLIC_FEATURE_MEDICATION=1 di .env.local.
 */
export const featureMedication = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_MEDICATION === "1";

/**
 * Sadar Gizi / scanner label (Fase 4). Ambang gizi ditinjau ahli gizi (gerbang §10
 * lulus) — LIVE di produksi. Dev: set NEXT_PUBLIC_FEATURE_NUTRITION=1 di .env.local.
 */
export const featureNutrition = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_NUTRITION === "1";

/**
 * Food Diary AI + Perencana Menu (Fase 6). Default OFF. FOOD_DB ditinjau ahli gizi vs
 * TKPI Kemenkes (gerbang lulus, Agu 2026); estimasi foto masakan < akurasi label
 * (framing "perkiraan"). Dev: set NEXT_PUBLIC_FEATURE_FOOD_DIARY=1 di .env.local.
 */
export const featureFoodDiary = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_FOOD_DIARY === "1";

/**
 * Medical Vault OCR (Fase 6 #1). Bagian modul biomarker (butuh featureBiomarker),
 * tapi sub-flag sendiri: menulis biomarker_readings source=vault_ocr + tabel baru
 * medical_documents → butuh migration 0022 di-db-push + Edge Function vault-scan
 * deploy sebelum nyala. Dev: set NEXT_PUBLIC_FEATURE_VAULT=1 di .env.local.
 */
export const featureVault = (): boolean =>
  featureBiomarker() && process.env.NEXT_PUBLIC_FEATURE_VAULT === "1";

/**
 * Family Health / Caregiver (Fase 6 #2). Default OFF. Kelola anggota keluarga +
 * (FM-2) pantau kesehatan mereka. Pendekatan aditif — fitur single-profile live
 * tak terpengaruh. Dev: set NEXT_PUBLIC_FEATURE_FAMILY=1 di .env.local.
 */
export const featureFamily = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_FAMILY === "1";

/**
 * Gamification (Fase 6 #6). Default OFF. XP/level/badge/misi harian DITURUNKAN dari
 * aktivitas yang sudah ada (habit, log, biomarker, gizi) — deterministik, tanpa tabel
 * baru (persistensi player_stats/achievements = GM-2). Aditif: regresi nol saat mati.
 * Dev: set NEXT_PUBLIC_FEATURE_GAMIFICATION=1 di .env.local.
 */
export const featureGamification = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_GAMIFICATION === "1";

/**
 * Early Warning / deteksi anomali baseline (Fase 6 #4). Default OFF. Menandai geseran
 * metrik (berat/tensi/gula/asam urat/tidur) terhadap baseline PRIBADI via z-score
 * deterministik — melengkapi Panel Risiko (ambang absolut). Butuh ≥~10 titik baseline
 * per metrik → diam bila data kurang. Tanpa tabel baru (murni derive dari Dexie).
 * Dev: set NEXT_PUBLIC_FEATURE_EARLY_WARNING=1 di .env.local.
 */
export const featureEarlyWarning = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_EARLY_WARNING === "1";

/**
 * Cek Nadi via kamera / rPPG (Fase 6 #3). Default OFF — SPIKE/PoC. Estimasi denyut
 * (BPM) dari ujung jari + flash, diproses on-device (video tak diunggah). BUKAN alat
 * medis. Flag baru nyala setelah gerbang akurasi + review medis (docs/addendum-rppg.md §7).
 * Dev: set NEXT_PUBLIC_FEATURE_RPPG=1 di .env.local.
 */
export const featureRppg = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_RPPG === "1";
