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
 * Mode Konsultasi — Laporan Dokter (V3-1 · MK-1). Default OFF. Merangkai data yang sudah
 * dicatat (biomarker/tren, Early Warning, obat, gaya hidup, gizi, dokumen) jadi laporan
 * rapi untuk dibawa ke dokter (on-screen/print, deterministik, non-diagnosis). Reuse data
 * (TANPA tabel baru). Berbagi via QR/link = MK-2 (menyusul, gerbang privasi).
 * Dev: set NEXT_PUBLIC_FEATURE_CONSULTATION=1 di .env.local.
 */
export const featureConsultation = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_CONSULTATION === "1";

/**
 * Simulasi "Bagaimana Jika" (V3-2). Default OFF. Proyeksi Health Score bila kebiasaan
 * berubah (tidur/hidrasi/langkah/olahraga) — DETERMINISTIK (reuse engine skor), memotivasi,
 * bukan janji medis. Tanpa tabel baru (derive baseline dari Dexie).
 * Dev: set NEXT_PUBLIC_FEATURE_WHATIF=1 di .env.local.
 */
export const featureWhatIf = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_WHATIF === "1";

/**
 * Laporan Bulanan + korelasi lintas-metrik (V3-3). Default OFF. Cari pola antar-metrik
 * (tidur↔mood, dll) via Pearson DETERMINISTIK + rata-rata bulanan — POLA, bukan sebab-akibat,
 * bukan diagnosis. Tanpa tabel baru (derive dari Dexie).
 * Dev: set NEXT_PUBLIC_FEATURE_MONTHLY=1 di .env.local.
 */
export const featureMonthlyInsight = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_MONTHLY === "1";

/**
 * Jadwal Imunisasi Anak (V3-6). Default OFF. Status vaksin (sudah/jatuh tempo/akan datang/
 * terlambat) DITERMINISTIK dari tanggal lahir + jadwal IDAI. Non-medis. Jadwal = KERANGKA,
 * WAJIB verifikasi vs IDAI sebelum flag nyala. Dev: set NEXT_PUBLIC_FEATURE_IMMUNIZATION=1.
 */
export const featureImmunization = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_IMMUNIZATION === "1";

/**
 * Kesehatan Siklus / menstruasi (V3-5). Default OFF. Prediksi siklus/fase/haid berikutnya/
 * jendela subur DETERMINISTIK dari riwayat haid. Data sensitif → RLS per profil. BUKAN alat
 * kontrasepsi/diagnosis. Butuh migration 0025 (cycle_logs) db-push sebelum nyala.
 * Dev: set NEXT_PUBLIC_FEATURE_CYCLE=1 di .env.local.
 */
export const featureCycle = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_CYCLE === "1";

/**
 * Cek Klaim Kesehatan / anti-hoaks (V3-4). Default OFF. Gerbang keamanan deterministik
 * (CK-1) + penilaian AI berpagar (CK-2, Edge Function claim-check) + sumber terkurasi.
 * Non-vonis, non-medis. GERBANG KONTEN (kurasi sumber + review medis) wajib lewat +
 * deploy claim-check sebelum flag nyala. Dev: set NEXT_PUBLIC_FEATURE_CEK_KLAIM=1.
 */
export const featureCekKlaim = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_CEK_KLAIM === "1";

/**
 * ArtaBot quick-log (backlog). Default OFF. Catat via chat ("minum 2 gelas", "tidur 7 jam")
 * → parser deterministik → tulis ke log yang ada (tak makan kuota AI). Reuse lib/quicklog.
 * Dev: set NEXT_PUBLIC_FEATURE_QUICKLOG=1 di .env.local.
 */
export const featureQuickLog = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_QUICKLOG === "1";

/**
 * Radar Sehat — kualitas udara (backlog). Default OFF. AQI lokasi via Open-Meteo (gratis,
 * tanpa key) → klasifikasi EPA deterministik + saran. Non-medis. Tanpa migrasi/backend.
 * Dev: set NEXT_PUBLIC_FEATURE_RADAR=1 di .env.local.
 */
export const featureRadar = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_RADAR === "1";

/**
 * Voice quick-log (backlog). Default OFF. Dikte suara (Web Speech id-ID) → teks → jalur chat
 * biasa (quick-log/AI). Reuse parseQuickLog + normalizeSpokenNumbers. Butuh featureQuickLog
 * untuk mencatat. Dev: set NEXT_PUBLIC_FEATURE_VOICE=1 di .env.local.
 */
export const featureVoice = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_VOICE === "1";

/**
 * Fokus Hari Ini (Fase 8 · KR-1 Konsolidasi & Retensi). Default OFF. Mesin DETERMINISTIK menyarikan
 * 1–3 hal paling relevan hari ini (rentetan di ambang putus, aktivasi skor pertama, log inti belum,
 * kekurangan hidrasi, rayakan bila lengkap) dari data yang sudah ada. Non-medis (ajakan mencatat).
 * Dev: set NEXT_PUBLIC_FEATURE_FOCUS=1 di .env.local.
 */
export const featureFocus = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_FOCUS === "1";

/**
 * Leaderboard (backlog · LB-1). Default OFF. Papan PRIBADI-temporal: poin aktivitas mingguanmu vs
 * minggu-minggu lalumu (rekor pribadi + momentum) via engine deterministik @arta/core, 100% lokal.
 * Poin turunan dari aktivitas (XP_RULES), bukan nilai kesehatan. Papan SOSIAL (bandingkan dgn orang
 * lain) = LB-3 di balik gerbang privasi + backend (docs/addendum-leaderboard.md §3/§6).
 * Dev: set NEXT_PUBLIC_FEATURE_LEADERBOARD=1 di .env.local.
 */
export const featureLeaderboard = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_LEADERBOARD === "1";

/**
 * Katalog Produk Komunal (backlog · KC-1). Default OFF. Cari produk yang pernah dipindai & pakai
 * ulang gizinya tanpa scan ulang (katalog LOKAL dari saved_products via engine deterministik
 * @arta/core: normalisasi identitas + konsensus median + cari). Verdict tetap personal di
 * perangkat. Berbagi komunal (baca/tulis termoderasi) = KC-2 (tunggu gerbang moderasi,
 * docs/addendum-katalog.md §3/§6). Dev: set NEXT_PUBLIC_FEATURE_CATALOG=1 di .env.local.
 */
export const featureCatalog = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_CATALOG === "1";

/**
 * SATUSEHAT / Interoperabilitas FHIR (backlog · SS-1). Default OFF. Ekspor data (biomarker/obat)
 * ke Bundle FHIR R4 (LOINC/UCUM) via engine deterministik @arta/core → unduh berkas .json di
 * perangkat (OFFLINE, tanpa unggah). Sinkronisasi jaringan SATUSEHAT (SS-2) butuh kredensial
 * organisasi Kemenkes → INERT sampai itu ada (docs/addendum-satusehat.md §2/§7). Non-medis.
 * Dev: set NEXT_PUBLIC_FEATURE_SATUSEHAT=1 di .env.local.
 */
export const featureSatuSehat = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_SATUSEHAT === "1";

/**
 * Wearable / Health Connect (V3-7 · WR-1). Default OFF. Data pasif perangkat (langkah/detak/
 * tidur/energi/berat/SpO₂) → engine dedup+rollup DETERMINISTIK (@arta/core) → Dexie/sync T1.
 * WR-1 = fondasi data yang INERT di web (tak ada pengambilan native). Native Health Connect/
 * HealthKit = WR-2 (butuh Capacitor + device) — flag TAK boleh nyala sebelum gerbang WR-0 lulus
 * (docs/addendum-wearable.md §8). Dev: set NEXT_PUBLIC_FEATURE_WEARABLE=1 di .env.local.
 */
export const featureWearable = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_WEARABLE === "1";

/**
 * Cek Nadi via kamera / rPPG (Fase 6 #3). Default OFF — SPIKE/PoC. Estimasi denyut
 * (BPM) dari ujung jari + flash, diproses on-device (video tak diunggah). BUKAN alat
 * medis. Flag baru nyala setelah gerbang akurasi + review medis (docs/addendum-rppg.md §7).
 * Dev: set NEXT_PUBLIC_FEATURE_RPPG=1 di .env.local.
 */
export const featureRppg = (): boolean =>
  process.env.NEXT_PUBLIC_FEATURE_RPPG === "1";
