# Gerbang & Launch · Fase 4 "Sadar Gizi"

**Tujuan:** memenuhi checklist rilis `addendum-sadar-gizi.md` §10–§11 sebelum flag `NEXT_PUBLIC_FEATURE_NUTRITION` dinyalakan di produksi. Fitur **tidak boleh aktif** sebelum: (A) ambang gizi + (B) matriks personalisasi kondisi + (C) sinonim & teks alergen di-review; dan langkah operasional (E) tuntas.

## Pagar aplikasi (konteks untuk reviewer)

- **AI hanya mengekstrak** label → JSON (`nutrition-scan`). **Penilaian (verdict) 100% deterministik** dihitung di klien dari tabel ambang ber-versi (`packages/core/nutrition.ts`) — bisa dijelaskan & diaudit, tidak berhalusinasi.
- **Tidak ada skor angka makanan.** Verdict = 3 tingkat + traffic-light per nutrien + dampak anggaran.
- Anggaran GGL = **pemandu, bukan larangan**. Tidak ada resep medis; anjuran maksimum "batasi / cari alternatif / diskusikan dokter".
- Alergen: aplikasi **menandai KEMUNGKINAN**, tidak pernah menjamin "bebas alergen".
- Semua ambang & teks bersifat **deterministik** (bukan output AI), diambil dari kode yang ditunjuk.

> Ambang saat ini = **KERANGKA** dengan `guideline_ref = "BPOM Nutri-Level (kerangka)"`. Wajib diganti nilai + rujukan tervalidasi saat review lulus (edit `packages/core/src/nutrition.ts` `DEFAULT_NUTRITION_BANDS` **dan** seed migration `0016_nutrition_bands.sql` agar sinkron).

---

## A. Ambang traffic-light (ahli gizi / rujukan Permenkes GGL & BPOM)

Nilai **per 100 g (padat) / 100 ml (minuman)**. Interval **[min, maks)** — batas atas eksklusif. Zona keseluruhan = zona terburuk dari {gula, natrium, lemak jenuh}.

| # | Nutrien | Bentuk | 🟢 Hijau (<) | 🟡 Kuning [.. , ..) | 🔴 Merah (≥) | Setuju? | Nilai revisi + rujukan |
|---|---|---|---|---|---|---|---|
| A1 | Gula | Minuman | < 2,5 g | 2,5 – 7,5 g | ≥ 7,5 g | ☐ | |
| A2 | Gula | Padat | < 5,0 g | 5,0 – 22,5 g | ≥ 22,5 g | ☐ | |
| A3 | Natrium | Minuman | < 120 mg | 120 – 600 mg | ≥ 600 mg | ☐ | |
| A4 | Natrium | Padat | < 120 mg | 120 – 600 mg | ≥ 600 mg | ☐ | |
| A5 | Lemak jenuh | Minuman | < 1,5 g | 1,5 – 5,0 g | ≥ 5,0 g | ☐ | |
| A6 | Lemak jenuh | Padat | < 1,5 g | 1,5 – 5,0 g | ≥ 5,0 g | ☐ | |
| A7 | **Lemak trans** | semua | — | — | **> 0 → paksa 🔴** + flag "Mengandung lemak trans — sebaiknya dihindari" (WHO) | ☐ | |
| A8 | Serat (penanda positif) | semua | ≥ 6 g/100 → "Tinggi serat 👍" | | | ☐ | |
| A9 | Protein (penanda positif) | semua | ≥ 10 g/100 → "Sumber protein baik 👍" | | | ☐ | |

**Anggaran GGL harian (Kemenkes G4G1L5):** gula **50 g** · natrium **2000 mg** · lemak total **67 g**. Basis %AKG label = **2150 kkal** (BPOM). Dampak dihitung **PER KEMASAN** (takaran saji × jumlah sajian) — membongkar jebakan "per sajian".

| Anggaran | Nilai | Setuju? | Revisi |
|---|---|---|---|
| Gula harian | 50 g | ☐ | |
| Natrium harian | 2000 mg | ☐ | |
| Lemak total harian | 67 g | ☐ | |
| Basis AKG | 2150 kkal | ☐ | |

**Lokasi kode:** `packages/core/src/nutrition.ts` (`DEFAULT_NUTRITION_BANDS`, `GGL_BUDGET`, `AKG_BASIS_KCAL`) + `supabase/migrations/0016_nutrition_bands.sql`.

**Ahli gizi:** ______________ (nama/gelar/STR)  **Tanda tangan/tanggal:** __________

---

## B. Matriks personalisasi kondisi (tenaga medis)

Saat pengguna (atau anggota "Pindai untuk") memantau kondisi, anggaran & nutrien utama disesuaikan.

| # | Kondisi | Penyesuaian | Nilai kerangka | Setuju? | Revisi |
|---|---|---|---|---|---|
| B1 | Hipertensi | Anggaran natrium diperketat | 2000 → **1500 mg** | ☐ | |
| B2 | Hipertensi | Nutrien utama disorot | Natrium | ☐ | |
| B3 | Diabetes | Nutrien utama disorot | Gula | ☐ | |
| B4 | Dislipidemia | Nutrien utama disorot | Lemak jenuh | ☐ | |
| B5 | Hiperurisemia / gout | (belum ada penyesuaian ambang; purin belum di label ING) | — | ☐ | |

> Catatan: kondisi anggota "Pindai untuk siapa" memakai matriks yang sama. "Saya" menarik kondisi dari `monitored_conditions` (Fase 2); hiperurisemia dipetakan ke `gout`.

**Lokasi kode:** `packages/core/src/nutrition.ts` (`dailyBudget`, `primaryNutrientFor`); pemetaan kondisi `apps/web/lib/nutrition.ts` (`CONDITION_MAP`).

**Tenaga medis:** ______________ (nama/gelar/SIP)  **Tanda tangan/tanggal:** __________

---

## C. Sinonim & bahasa alergen (ahli gizi/alergi)

Deteksi = pencocokan **batas kata** teks daftar bahan terhadap sinonim di bawah. Menandai kemungkinan, tidak menolak. Kacang tanah dipisah dari kacang pohon.

| Alergen | Sinonim yang dicocokkan (huruf kecil) | Setuju? | Tambah/kurangi |
|---|---|---|---|
| Susu | susu, milk, laktosa, lactose, whey, kasein, casein, keju, cheese, mentega, butter, krim, cream, yogurt, yoghurt | ☐ | |
| Telur | telur, egg, albumin, ovalbumin | ☐ | |
| Ikan | ikan, fish, tuna, salmon, teri, sarden, sardine, tongkol | ☐ | |
| Udang & Kerang | udang, shrimp, kepiting, crab, lobster, kerang, cumi, tiram, oyster, krustasea, krustacea | ☐ | |
| Kacang Tanah | kacang tanah, peanut, groundnut | ☐ | |
| Kacang Pohon | almond, mede, mete, kacang mede, kacang mete, kenari, hazelnut, pistachio, kacang pohon, walnut, pecan, macadamia | ☐ | |
| Kedelai | kedelai, soy, soya, soybean, tahu, tempe, kecap, edamame, lesitin kedelai, isolat kedelai | ☐ | |
| Gandum/Gluten | gandum, wheat, terigu, gluten, barley, jelai, rye, gandum hitam | ☐ | |
| Wijen | wijen, sesame, tahini | ☐ | |

**Lokasi kode:** `packages/core/src/allergen.ts` (`ALLERGEN_DEFS`).

**Ahli gizi/alergi:** ______________  **Tanda tangan/tanggal:** __________

---

## D. Teks keselamatan & verdict (verbatim — review medis + gizi)

| # | Konteks | Teks (verbatim) | Lokasi kode | Setuju? | Revisi |
|---|---|---|---|---|---|
| D1 | Headline verdict | 🟢 "Pilihan baik" · 🟡 "Boleh, secukupnya" · 🔴 "Sebaiknya batasi" | `nutrition.ts` `HEADLINE` | ☐ | |
| D2 | Alasan merah/kuning | "{Nutrien} satu kemasan ≈ {X}% anggaran harian Anda{(batas lebih ketat karena pemantauan tensi)}." | `nutrition.ts` `nutritionVerdict` | ☐ | |
| D3 | Anjuran merah | "Pertimbangkan alternatif lebih rendah {nutrien}, atau konsumsi dalam porsi kecil." | `nutrition.ts` | ☐ | |
| D4 | Disclaimer kartu | "Anggaran = pemandu, bukan larangan. Ambang gizi masih kerangka & menunggu verifikasi ahli gizi." | `NutritionScanCard.tsx` | ☐ | |
| D5 | Alert alergen (judul) | "⚠️ Kemungkinan mengandung alergen Anda" | `NutritionScanCard.tsx` `AllergenAlert` | ☐ | |
| D6 | Alert alergen (disclaimer) | "Ditandai dari daftar bahan — bukan jaminan. Label bisa tak lengkap / ada kontaminasi silang; cek kemasan langsung." | `NutritionScanCard.tsx` | ☐ | |
| D7 | Disclaimer kartu alergi | "Kami menandai kemungkinan kandungan dari daftar bahan — bukan jaminan bebas alergen. Label bisa tak lengkap atau ada kontaminasi silang. Untuk alergi berat, selalu cek kemasan langsung." | `AllergyCard.tsx` | ☐ | |
| D8 | Foto bukan label (422) | "Kami tidak menemukan tabel Informasi Nilai Gizi. Coba foto bagian belakang kemasan." | `supabase/functions/nutrition-scan/index.ts` | ☐ | |

**Tenaga medis/gizi:** ______________  **Tanda tangan/tanggal:** __________

---

## E. Langkah operasional launch (setelah A–D lulus & revisi diterapkan)

1. **Terapkan revisi** ambang/teks di lokasi kode yang ditunjuk. Jika ambang berubah: perbarui `DEFAULT_NUTRITION_BANDS` **dan** `0016_nutrition_bands.sql` (naikkan `version`, isi `guideline_ref` riil), lalu `pnpm -r test`.
2. **db-push migrasi Fase 4** ke remote (lindungi push live):
   ```bash
   supabase db push   # menerapkan 0016, 0017, 0018, 0019, 0020
   ```
   > **Penting:** `0017` (`product_scans`, `food_logs`), `0018` (`saved_products`), `0019` (`allergy_cards`), `0020` (`nutrition_eaters`) sudah masuk `SYNC_TABLES` di klien → produksi menariknya tiap 30 dtk walau flag mati. Push lebih awal untuk menghentikan request gagal (walau non-fatal). `0016` tabel referensi.
3. **Deploy Edge Function vision** + set env provider vision:
   ```bash
   supabase functions deploy nutrition-scan
   ```
   Set `SUMOPOD_BASE_URL`, `SUMOPOD_API_KEY`, dan `AI_MODEL_VISION` (mis. model vision Sumopod). `verify_jwt` aktif (klien kirim Authorization).
4. **Regresi vision (§10):** uji ekstraksi pada **korpus ≥ 100 label riil** (ragam pencahayaan/sudut/merek). Pastikan `sanityCheck` menandai kekeliruan satuan (natrium mg vs g, energi vs makro ±25%, gula ≤ karbo, dll). Target akurasi & langkah "turun anggun" (foto bukan label, offline) terverifikasi.
5. **Nyalakan flag** di Vercel: `NEXT_PUBLIC_FEATURE_NUTRITION=1` → redeploy.
6. **Uji asap produksi:** entri manual → verdict; foto label → ekstraksi + konfirmasi field confidence; Catat ke Food Diary → GGL Budget terisi; Simpan Produk & Pindai Pembanding; Kartu Alergi + alert; "Pindai untuk" anggota → verdict/alergen berganti.

## Catatan cakupan

- **Lemari** (`saved_products`) berbagi di profil pemilik; berbagi lintas-akun penuh menunggu rearsitektur profil global (bukan bagian Fase 4).
- **Purin/asam urat** belum ada di label ING standar → tidak ada ambang gout (lihat B5).
- Fitur billing PRO (Fase 4 blueprint) **di luar** cakupan Sadar Gizi.
