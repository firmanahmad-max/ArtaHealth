# ArtaHealth — Addendum 3: "Sadar Gizi" (Nutrition Facts Scanner)

### Foto Label Gizi Kemasan → Penilaian Personal Berbasis Profil Kesehatan

**Version:** 1.0-NG (Addendum untuk Blueprint v1.0-TB, UI/UX Spec v1.0-DS, Addendum SK v1.0-SK, Addendum RM v1.0-RM)
**Owner:** Arta Ecosystem — Firman Ahmad
**Konsep inti:** *"Label gizi bukan untuk dibaca ahli gizi — foto saja, Arta yang menerjemahkannya untuk kondisi Anda."*

---

## 1. Rasional Produk

### 1.1 Masalah

Label **Informasi Nilai Gizi (ING)** wajib ada di kemasan pangan olahan Indonesia (regulasi BPOM), tapi hampir tidak berfungsi bagi konsumen awam karena tiga hal:

1. **Tidak bisa dibaca cepat** — angka mg/g, %AKG, dan takaran saji butuh literasi gizi.
2. **Jebakan takaran saji** — minuman 500 ml mencantumkan gizi per takaran saji 250 ml; konsumen mengira gula "cuma 22 g" padahal meminum 44 g (hampir seluruh batas harian).
3. **Tidak personal** — label yang sama dibaca berbeda oleh penderita hipertensi (natrium), diabetes (gula), dislipidemia (lemak jenuh), dan asam urat (bahan tertentu). Tidak ada yang menerjemahkan.

Sementara itu, konsumsi Gula-Garam-Lemak (GGL) berlebih adalah pendorong utama PTM di Indonesia — persis empat kondisi yang dipantau **Silent Killer Guard**. Kemenkes sudah lama mengampanyekan batas harian **G4G1L5** (gula 4 sdm ≈ 50 g, garam 1 sdt ≈ 2.000 mg natrium, lemak 5 sdm ≈ 67 g), dan BPOM tengah menyiapkan label Nutri-Level di kemasan depan — momentum regulasi yang tepat untuk fitur ini.

### 1.2 Posisi Fitur

"Sadar Gizi" adalah jembatan antara **Food Diary AI** (apa yang sudah dimakan) dan **Silent Killer Guard** (kondisi yang dipantau): keputusan *sebelum* membeli/mengonsumsi, dipersonalisasi ke kondisi user. Pembeda vs aplikasi scanner global (Yuka dkk.): format label BPOM, basis %AKG Indonesia, batas GGL Kemenkes, Bahasa Indonesia, dan — yang tidak dimiliki siapa pun — **profil kondisi dari Silent Killer Guard + mode keluarga + konteks puasa**.

Use case kuncinya sangat nyata: Firman di minimarket memindai teh kemasan untuk ayahnya yang hipertensi — "Untuk profil Ayah: natrium aman, tapi gula 60% batas harian. Ada alternatif lebih rendah gula."

---

## 2. Prinsip Desain (konsisten dengan seluruh produk)

1. **AI mengekstrak, rule engine menilai.** Vision model hanya membaca label menjadi JSON terstruktur. Penilaian "baik/batasi untuk Anda" dihitung **deterministik** dari tabel ambang ber-versi — bisa dijelaskan, bisa diaudit, tidak berhalusinasi.
2. **Per kemasan, bukan per takaran saji.** Verdict utama selalu dihitung untuk *jumlah yang realistis dikonsumsi* (default: seluruh kemasan untuk single-serve) — membongkar jebakan takaran saji, bukan mewarisinya.
3. **Anggaran, bukan larangan.** Bahasa utama adalah **GGL Budget** harian: "Produk ini memakai 35% jatah gula harian Anda." User memutuskan; Arta memberi kesadaran.
4. **Saran gaya hidup, bukan resep medis.** Untuk kondisi terpantau, ambang lebih ketat diterapkan dan disebut sumbernya; anjuran maksimum adalah "batasi / cari alternatif / diskusikan dengan dokter" — tidak pernah "haram/dilarang untuk penyakit Anda".
5. **Jujur terhadap keterbatasan OCR.** Confidence rendah → minta konfirmasi user. Deteksi alergen dari daftar bahan adalah *bantuan penandaan*, bukan jaminan keselamatan — selalu dengan disclaimer verifikasi manual.

---

## 3. Alur & Arsitektur Pipeline

```
📷 Foto label (ING + daftar bahan, boleh 2 foto)
   └─ Client: kompres (max 1280px, webp), crop guide overlay
        ↓ upload bucket privat
🤖 Edge Function `nutrition-scan` (AI Gateway use-case baru)
   ├─ Vision model (Sumopod): ekstraksi → JSON terstruktur
   ├─ Validator (Zod + sanity rules):
   │    · satuan natrium mg vs g (bahaya OCR klasik — natrium "2 g" = 2000 mg)
   │    · energi ≈ 4×(karbo+protein) + 9×lemak ± toleransi 25% → jika melenceng, flag re-check
   │    · gula ≤ karbohidrat total; lemak jenuh ≤ lemak total
   │    · takaran saji × jumlah sajian vs isi bersih kemasan
   ├─ confidence < 0.7 pada field kunci → UI konfirmasi/edit manual
   ↓
⚖️ Rule Engine `nutrition-verdict` (packages/core — deterministik, teruji 100%)
   ├─ Normalisasi: per 100 g/ml + per kemasan + per takaran saji
   ├─ Traffic light per nutrien (tabel ambang ber-versi)
   ├─ Personalisasi: monitored_conditions + profil (usia, target) + fasting_days
   ├─ GGL Budget: kurangi dari sisa anggaran harian (akumulasi food_logs hari ini)
   └─ Flag bahan: alergen (dari emergency_cards), pemanis, MSG-info, purin-terkait
   ↓
📱 Kartu hasil: verdict + rincian + saran + [Tambahkan ke Food Diary] [Simpan Produk]
```

**Ekstraksi — kontrak JSON (output vision, divalidasi Zod):**

```json
{
  "product_guess": "Teh Melati Kemasan 500ml",
  "serving_size": { "value": 250, "unit": "ml" },
  "servings_per_pack": 2,
  "net_content": { "value": 500, "unit": "ml" },
  "per_serving": {
    "energy_kcal": 90, "fat_g": 0, "sat_fat_g": 0, "trans_fat_g": 0,
    "protein_g": 0, "carb_g": 22, "sugar_g": 21, "fiber_g": 0,
    "sodium_mg": 45, "extras": { "kalium_mg": null }
  },
  "akg_basis_kcal": 2150,
  "ingredients_raw": "air, gula, ekstrak teh, perisa melati, ...",
  "confidence": { "sugar_g": 0.96, "sodium_mg": 0.88, "ingredients": 0.9 }
}
```

Basis %AKG label Indonesia (2.150 kkal, per regulasi BPOM) disimpan sebagai konstanta ber-versi — bukan diasumsikan sama dengan basis 2.000 kkal label luar.

---

## 4. Rule Engine: Ambang & Personalisasi

### 4.1 Tabel Ambang Ber-versi (pola `biomarker_bands`)

```sql
create table nutrition_bands (
  id            uuid primary key default gen_random_uuid(),
  nutrient      text not null,      -- sugar|sodium|sat_fat|total_fat|fiber|protein
  food_form     text not null,      -- solid|beverage  (ambang minuman berbeda)
  band_key      text not null,      -- low|medium|high
  per_100_min   numeric,
  per_100_max   numeric,
  condition_tag text,               -- null=umum | hypertension|diabetes|dyslipidemia|gout
  guideline_ref text not null,      -- 'Permenkes GGL (G4G1L5)', 'BPOM ING/Nutri-Level', dst.
  version       int not null default 1,
  active        boolean not null default true
);
```

> ⚠️ Seluruh angka ambang di bawah adalah **kerangka awal untuk di-seed dan WAJIB diverifikasi** terhadap dokumen resmi terbaru (Permenkes, BPOM Nutri-Level, pedoman profesi) + review ahli gizi/tenaga medis sebelum rilis — sama seperti protokol `biomarker_bands`.

**Anggaran harian (basis GGL Kemenkes — G4G1L5):** gula 50 g · natrium 2.000 mg · lemak total 67 g. Ditampilkan sebagai tiga bar anggaran.

**Traffic light per 100 g/ml (kerangka, mengacu pola FSA/Nutri-Level):** gula minuman — hijau ≤2,5 g, kuning ≤7,5 g, merah >7,5 g; gula padatan — hijau ≤5 g, merah >22,5 g; natrium — hijau ≤120 mg, merah >600 mg; lemak jenuh — hijau ≤1,5 g, merah >5 g. Serat & protein mendapat penanda positif (hijau terbalik).

### 4.2 Matriks Personalisasi Kondisi

| Kondisi terpantau (`monitored_conditions`) | Penyesuaian rule engine | Contoh output |
|---|---|---|
| **Hipertensi** | Anggaran natrium diperketat (kerangka: 1.500 mg/hari, tandai untuk verifikasi medis); natrium jadi nutrien utama kartu; flag bahan tinggi-natrium tersembunyi (MSG, kecap, baking soda) | "Natrium 1 kemasan = 48% anggaran harian Anda (batas lebih ketat karena pemantauan tensi)" |
| **Diabetes / Prediabetes** | Gula jadi nutrien utama; sorot karbohidrat total & serat; flag pemanis berkalori di daftar bahan (sirup fruktosa, dekstrosa, maltodekstrin); catatan indeks-gula kemasan minuman | "Gula 42 g ≈ 84% batas harian umum — untuk kondisi Anda, pertimbangkan alternatif tanpa gula" |
| **Dislipidemia** | Lemak jenuh + lemak trans jadi utama; flag "minyak terhidrogenasi"; apresiasi serat tinggi | "Lemak jenuh tinggi (7 g/saji). Serat 6 g adalah nilai plusnya" |
| **Asam urat / Gout** | Flag bahan terkait purin/pemicu yang umum (ekstrak ragi, jeroan/ekstrak daging, sarden/teri) & fruktosa tinggi | "Mengandung ekstrak ragi — bahan yang umum disarankan dibatasi. Konfirmasi dengan dokter Anda" |
| **Tanpa kondisi** | Anggaran GGL umum + traffic light standar | "Cukup manis: 35% jatah gula harian. Aman sesekali 👍" |
| **Profil anak (Family)** | Anggaran diskalakan usia; peringatan kafein/pemanis untuk anak | "Untuk Adik (7 th): kafein terdeteksi — tidak disarankan" |
| **Mode puasa aktif** | Konteks sahur/berbuka: apresiasi protein+serat untuk sahur; peringatan gula tinggi saat berbuka perut kosong | "Untuk sahur: protein rendah — kurang mengenyangkan hingga berbuka" |

**Verdict keseluruhan (3 tingkat, bahasa tidak menghakimi):**
🟢 **"Pilihan baik"** · 🟡 **"Boleh, secukupnya"** · 🔴 **"Sebaiknya batasi"** — plus satu kalimat alasan terkuat + satu saran actionable. Tidak ada skor angka 0–100 untuk makanan (menghindari kesan "makanan haram/halal gizi" yang memicu relasi tidak sehat dengan makanan — selaras kebijakan wellbeing produk).

### 4.3 Deteksi Alergen (sinergi Emergency Card)

- Daftar alergi di `emergency_cards.allergies` dicocokkan (fuzzy + sinonim: "kacang" → kacang tanah/mede/almond; "susu" → whey/kasein/laktosa) terhadap `ingredients_raw`.
- Cocok → banner paling atas: ⚠️ "Terdeteksi kemungkinan **kacang** — alergi yang Anda catat. **Periksa langsung label fisiknya**; hasil pemindaian bisa keliru."
- **Tidak cocok → tidak menampilkan "bebas alergen"** — absence of evidence bukan jaminan; ini keputusan keselamatan yang tidak bisa ditawar.

---

## 5. Model Data

```sql
create table product_scans (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id),   -- profil TARGET verdict (bisa anggota keluarga)
  scanned_by    uuid not null references profiles(id),
  product_name  text,
  photo_path    text not null,
  extracted     jsonb not null,          -- JSON hasil vision (final, pasca-koreksi user)
  user_corrected boolean not null default false,
  verdict       jsonb not null,          -- {overall, per_nutrient:{...}, flags:[], budget_impact:{...}, bands_version}
  scanned_at    timestamptz not null default now(),
  client_id     text,
  deleted_at    timestamptz,
  unique (profile_id, client_id)
);

create table saved_products (             -- "lemari produk" pribadi
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references auth.users(id),
  product_name  text not null,
  nutrition     jsonb not null,           -- snapshot per 100g + per kemasan
  last_verdicts jsonb,                    -- cache verdict per profil keluarga
  scan_count    int not null default 1,
  updated_at    timestamptz not null default now()
);
create index idx_scans_profile_time on product_scans (profile_id, scanned_at desc);
```

- **Verdict disimpan bersama `bands_version`** — hasil lama tetap bisa dijelaskan meski ambang diperbarui (pola yang sama dengan `biomarker_readings.classified`).
- `saved_products` membuat pemindaian kedua produk yang sama instan (match nama+gizi) dan menghidupkan fitur **bandingkan 2 produk** (PRO).
- Katalog produk komunal (crowdsourced) **sengaja ditunda** ke evaluasi V3+ — kualitas data & moderasi adalah proyek tersendiri; local-first dulu.

---

## 6. UI/UX (update Spec v1.0-DS)

1. **Entry point:** aksi baru di FAB Food Diary "📷 Pindai Label" + shortcut di kartu Silent Killer Guard ("Cek produk untuk kondisi Anda"). Kamera langsung dengan **overlay panduan bingkai** ("Pastikan tabel Informasi Nilai Gizi terbaca penuh") + tombol tambah foto ke-2 untuk daftar bahan.
2. **Kartu Hasil (komponen `<ScanVerdictCard />`):**
   - Header: nama produk (editable) + selektor profil target (avatar keluarga — default profil aktif).
   - **Verdict badge** 🟢/🟡/🔴 + satu kalimat alasan.
   - **Toggle takaran: "Per kemasan (500 ml)" ⟷ "Per takaran saji (250 ml)"** — default per kemasan; inilah fitur anti-jebakan-label.
   - **Tiga bar GGL Budget** (Gula/Garam/Lemak): terisi = konsumsi hari ini dari food_logs, segmen berkedip = dampak produk ini jika dikonsumsi. Visual paling penting fitur ini.
   - Rincian nutrien traffic-light (tap → penjelasan + sumber ambang).
   - Flag bahan (alergen paling atas, lalu kondisi-spesifik).
   - Aksi: **[Saya konsumsi — catat ke Food Diary]** (masuk `food_logs`, anggaran ter-update) · [Simpan Produk] · [Pindai Pembanding].
3. **Confidence rendah:** field bermasalah ditampilkan dengan latar kuning + nilai bisa diedit ("Kami membaca natrium **450 mg** — sudah benar?") sebelum verdict dirender. Verdict tidak pernah tampil dari data yang diragukan.
4. **Empty/error state:** foto bukan label gizi → "Kami tidak menemukan tabel Informasi Nilai Gizi. Coba foto bagian belakang kemasan." (bukan error teknis).
5. **Microcopy:** nada teman yang melek gizi — "Boleh kok, tapi ini 60% jatah gula hari ini. Sisanya air putih ya 😄" (emoji hanya di verdict hijau/kuning; verdict merah & alergen selalu tanpa emoji).
6. **Aksesibilitas:** verdict tidak hanya warna — selalu ikon + label teks; bar anggaran punya nilai numerik.

---

## 7. Sinergi Ekosistem

| Modul | Sinergi |
|---|---|
| **Food Diary** | "Catat ke Food Diary" satu tap — scanner menjadi jalur input nutrisi paling akurat (data label > estimasi foto makanan) |
| **Silent Killer Guard** | Kondisi terpantau → personalisasi verdict; sebaliknya, pola scan gula tinggi berulang bisa memicu saran skrining GDS |
| **GGL Budget ↔ AI Insight** | "Minggu ini rata-rata natrium Anda 2.600 mg/hari, terutama dari mi instan — turunkan ke ~2.000 mg dengan..." |
| **Family Health** | Verdict per anggota keluarga dari satu pemindaian; belanja untuk orang tua jadi use case utama |
| **Mode Ramadan** | Konteks sahur/berbuka pada verdict (§4.2) |
| **Habit Engine** | Verdict merah berulang pada kategori sama → tawaran habit ("Ganti minuman manis dengan air, 14 hari") |
| **ArtaFin (opsional, jauh)** | Produk yang dipindai + dibeli → korelasi belanja vs gizi (butuh consent, evaluasi V4) |

---

## 8. Monetisasi & Cost Guard

| | Free | PRO |
|---|---|---|
| Pindai label | 3/hari | Unlimited (fair use 50/hari) |
| Verdict personal (kondisi) | ✓ | ✓ |
| Riwayat & lemari produk | 7 hari | Penuh |
| Bandingkan 2 produk | — | ✓ |
| Verdict multi-profil keluarga | 1 profil | Semua profil |

Cost guard: vision call hanya sekali per produk-per-akun (cache `saved_products`); foto dikompres agresif; ekstraksi memakai model vision hemat via routing AI Gateway (kandidat use-case pertama untuk offload ke rig lokal AMD saat development/batch).

---

## 9. Penempatan Roadmap & Estimasi

Fitur ini **satu work-stream dengan Food Diary AI (V2)** — berbagi pipeline vision, storage foto, dan tabel `food_logs`. Urutan di dalam V2: justru **scanner dulu, baru foto makanan** — ekstraksi teks label jauh lebih akurat daripada estimasi foto masakan, sehingga kepercayaan user pada "AI gizi" dibangun dari fitur yang paling jarang salah.

| Sprint | Isi | Durasi |
|---|---|---|
| NG-1 | Skema + seed `nutrition_bands` + rule engine & GGL Budget (test 100%) | 1,5 minggu |
| NG-2 | Edge Function ekstraksi + validator sanity + alur konfirmasi confidence | 1,5 minggu |
| NG-3 | UI kartu hasil + bar anggaran + toggle takaran + integrasi Food Diary | 1,5 minggu |
| NG-4 | Personalisasi kondisi + alergen + multi-profil + review konten (ahli gizi/medis) | 1,5 minggu |

**Total ±6 minggu.** Posisi: V2, setelah work-stream Mode Ramadan (atau paralel jika ada kapasitas — dependensi silangnya kecil).

---

## 10. Risiko Spesifik & Mitigasi

| Risiko | Mitigasi |
|---|---|
| OCR salah baca satuan/angka → saran menyesatkan | Validator sanity (§3), konfirmasi confidence rendah, verdict menyimpan data final pasca-koreksi user |
| False negative alergen → bahaya nyata | Tidak pernah mengklaim "bebas alergen"; disclaimer verifikasi fisik wajib di setiap banner alergen |
| Format label ING sangat bervariasi (lama/baru, tabel/naratif, dwibahasa) | Korpus uji ≥100 foto label produk riil Indonesia (mudah dikumpulkan dari stok Max Computer & minimarket Samarinda) sebagai regression test ekstraksi |
| Ambang gizi diperdebatkan / berubah regulasi | Semua ambang di `nutrition_bands` ber-versi + sumber; halaman "Standar & Referensi" (pola Addendum SK §3) diperluas |
| Fitur memicu relasi tidak sehat dengan makanan | Tanpa skor angka makanan; bahasa anggaran bukan larangan; verdict merah selalu disertai alternatif, bukan sekadar peringatan |

## 11. Checklist Pra-Rilis

- [ ] Verifikasi ambang: dokumen GGL Kemenkes, regulasi ING & Nutri-Level BPOM terbaru, basis %AKG 2.150 kkal → simpan PDF resmi di `/docs/clinical-refs/`
- [ ] Review matriks personalisasi kondisi (§4.2) oleh tenaga medis/ahli gizi
- [ ] Regression test ekstraksi terhadap korpus ≥100 label riil (target akurasi field kunci ≥95% dengan confidence gating)
- [ ] Uji jebakan takaran saji end-to-end (multi-serving pack default per kemasan)
- [ ] Audit copy: tidak ada frasa diagnosis/larangan medis; alergen selalu ber-disclaimer
- [ ] Uji offline: pemindaian antre di outbox, verdict dirender saat tersinkron

## 12. Ringkasan Perubahan Dokumen Sebelumnya

| Dokumen | Perubahan |
|---|---|
| Blueprint §1.3 | Modul `nutrition` diperluas: sub-fitur `label-scanner` + rule engine verdict |
| Blueprint §3 | + `nutrition_bands`, `product_scans`, `saved_products` |
| Blueprint §5.1 | + use-case AI Gateway: `nutrition_scan` (vision, cache-aware) |
| Blueprint §11 | Tabel monetisasi + baris pindai label |
| UI/UX Spec §2 | + `<ScanVerdictCard />`, bar GGL Budget, overlay kamera label |
| UI/UX Spec §3.5 | Food Diary: FAB + "Pindai Label"; urutan pembangunan V2 direvisi (scanner dulu) |
| Addendum SK | Sinergi dua arah kondisi ⟷ verdict (§7) |
| Addendum RM | Verdict sadar sahur/berbuka (§4.2) |

---

*"Sadar Gizi" mengubah ArtaHealth dari pencatat menjadi penasihat di titik keputusan — di lorong minimarket, sebelum gula itu dibeli. Dan karena verdict-nya lahir dari rule engine yang bisa diaudit, ArtaHealth bisa mempertanggungjawabkan setiap sarannya: sesuatu yang tidak bisa dilakukan aplikasi yang menyerahkan penilaian gizi kepada halusinasi model.*
