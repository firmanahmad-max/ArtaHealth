# ArtaHealth — Addendum: Modul "Silent Killer Guard"

### Analisis HealthGuard AI & Integrasi Monitoring Biomarker Berstandar Klinis Indonesia

**Version:** 1.0-SK (Addendum untuk Technical Blueprint v1.0-TB & UI/UX Spec v1.0-DS)
**Owner:** Arta Ecosystem — Firman Ahmad
**Referensi analisis:** healthguard.mshadianto.my.id (HealthGuard AI, M. Sopian Hadianto)

---

## 1. Analisis HealthGuard AI

### 1.1 Keterbatasan Analisis (Transparansi)

Situs HealthGuard adalah SPA yang dirender penuh via JavaScript — konten UI-nya tidak bisa dibaca melalui fetch server-side. Analisis di bawah dibangun dari metadata situs (deskripsi, positioning, klaim standar) dan verifikasi independen terhadap standar klinis yang dirujuknya. Detail UX layar-per-layar HealthGuard tidak tersedia — jadi kita **mengadopsi konsep dan standarnya, bukan meniru implementasinya**. Ini justru posisi yang benar secara etika produk.

### 1.2 Apa yang Bisa Dipetakan dari HealthGuard

| Aspek | Temuan | Nilai untuk ArtaHealth |
|---|---|---|
| **Positioning** | "Pantau Silent Killers dengan AI" — fokus 4 kondisi: hipertensi, diabetes, kolesterol, asam urat | ⭐⭐⭐ Sangat kuat. Ini celah besar di PRD ArtaHealth v1.0 |
| **Grounding klinis** | Klaim "Sesuai standar PERKI & PERKENI" — merujuk organisasi profesi Indonesia, bukan guideline asing mentah | ⭐⭐⭐ Standar bernama = kredibilitas + akuntabilitas |
| **Target pasar** | "Untuk masyarakat Indonesia" — bahasa, konteks, prevalensi lokal | ⭐⭐ Sejalan dengan ArtaHealth |
| **Format** | PWA mobile (apple-mobile-web-app-capable, viewport-fit=cover) | ⭐ Sama dengan arsitektur ArtaHealth |
| **Pendekatan landing** | Anchor `#story` — landing berbasis narasi/storytelling, bukan daftar fitur | ⭐⭐ Diadopsi untuk landing page ArtaHealth |

### 1.3 Kenapa Konsep Ini Penting (Konteks Epidemiologi)

PRD ArtaHealth v1.0 kuat di *lifestyle & habit* (tidur, hidrasi, aktivitas, mood) tapi **tidak menyentuh penyakit tidak menular (PTM) utama Indonesia** — padahal:

- Hipertensi, diabetes, dislipidemia, dan hiperurisemia adalah kondisi berprevalensi tinggi di Indonesia dan sebagian besar penderitanya **tidak sadar mengidapnya** (karakter "silent killer" — tanpa gejala hingga komplikasi).
- Target user sekunder PRD ("orang tua, lansia, keluarga muda") justru kelompok yang paling membutuhkan monitoring ini — dan fitur **Family Health** ArtaHealth adalah kendaraan sempurnanya: anak memantau tekanan darah orang tua dari satu akun.
- Alat ukurnya murah dan sudah umum di rumah tangga Indonesia (tensimeter digital ±Rp 200–400 ribu, glukometer + strip GDS, hasil lab puskesmas/prolanis).

**Kesimpulan analisis:** HealthGuard memvalidasi bahwa ada kebutuhan nyata untuk monitoring PTM berbahasa Indonesia dengan standar lokal. ArtaHealth harus mengintegrasikan konsep ini — dan bisa melakukannya lebih baik karena punya fondasi yang HealthGuard (tampaknya) tidak punya: **Medical Vault dengan OCR** (hasil lab otomatis jadi data terstruktur), **Family Health**, **Habit Engine** (tindak lanjut jadi kebiasaan), dan **ekosistem** (biaya obat → ArtaFin).

---

## 2. Desain Modul: `biomarkers` — "Silent Killer Guard"

### 2.1 Prinsip Desain

1. **Klasifikasi deterministik berbasis guideline, bukan LLM.** Sama seperti Health Score: nilai → band klasifikasi lewat tabel rentang yang dipublikasikan organisasi profesi. AI hanya menulis narasi & edukasi. Tidak ada "AI menilai tekanan darah Anda".
2. **Edukasi & penapisan mandiri, bukan diagnosis.** Semua label memakai bahasa klasifikasi ("berada di rentang Hipertensi Derajat 1 menurut konsensus"), selalu disertai anjuran konfirmasi ke tenaga kesehatan. Diagnosis hanya oleh dokter.
3. **Biomarker TIDAK masuk Health Score harian.** Health Score mengukur *perilaku* (yang bisa diubah hari itu); biomarker mengukur *kondisi* (berubah lambat). Mencampurnya membuat skor tidak adil dan menakutkan. Biomarker mendapat panel sendiri: **Risk Panel**.
4. **Setiap zona merah = jalur aksi jelas**, bukan sekadar warna menakutkan.

### 2.2 Empat Biomarker & Tabel Klasifikasi (Referensi Implementasi)

> ⚠️ **Aturan engineering:** semua rentang di bawah disimpan sebagai **data konfigurasi ber-versi** (tabel `biomarker_bands`), bukan hardcoded — guideline bisa diperbarui. Sebelum rilis, setiap tabel wajib diverifikasi ulang terhadap dokumen guideline terbaru (Konsensus PERHI/InaSH, PERKENI, PERKI) dan idealnya di-review satu tenaga medis. Versi guideline ditampilkan di UI ("Berdasarkan Konsensus Hipertensi Indonesia 2021").

#### A. Tekanan Darah — Konsensus PERHI/InaSH (mengadopsi ESC/ESH 2018; diagnosis HT ≥140/90)

| Klasifikasi | Sistolik (mmHg) | | Diastolik (mmHg) | Zona UI |
|---|---|---|---|---|
| Optimal | < 120 | dan | < 80 | 🟢 |
| Normal | 120–129 | dan/atau | 80–84 | 🟢 |
| Normal-Tinggi | 130–139 | dan/atau | 85–89 | 🟡 |
| Hipertensi Derajat 1 | 140–159 | dan/atau | 90–99 | 🟠 |
| Hipertensi Derajat 2 | 160–179 | dan/atau | 100–109 | 🔴 |
| Hipertensi Derajat 3 | ≥ 180 | dan/atau | ≥ 110 | 🔴 **Red-flag** |

Aturan tambahan: klasifikasi mengikuti kategori **tertinggi** dari sistolik/diastolik. Pengukuran ≥180/110 → UI meminta istirahat 5 menit lalu ukur ulang; jika tetap → kartu darurat "Segera hubungi/kunjungi fasilitas kesehatan".

#### B. Gula Darah — kriteria PERKENI (Pedoman Pengelolaan DM Tipe 2)

| Pemeriksaan | Normal | Prediabetes | Diabetes* |
|---|---|---|---|
| Gula Darah Puasa (GDP) | < 100 mg/dL | 100–125 | ≥ 126 |
| Gula Darah Sewaktu / 2 jam TTGO | < 140 mg/dL | 140–199 | ≥ 200 |
| HbA1c | < 5,7% | 5,7–6,4% | ≥ 6,5% |

\* Label UI: "berada di rentang kriteria diabetes — perlu pemeriksaan konfirmasi oleh dokter" (diagnosis memerlukan pemeriksaan ulang/konfirmasi klinis).
Red-flag: GDS < 70 mg/dL (hipoglikemia) atau ≥ 300 mg/dL → kartu tindakan segera.
Input GDS wajib menyertakan konteks: puasa / sewaktu / 2 jam setelah makan — klasifikasi berbeda per konteks.

#### C. Profil Lipid — rentang standar laporan laboratorium (NCEP ATP III, yang dipakai lab Indonesia)

| Parameter | Optimal/Normal | Batas Tinggi | Tinggi |
|---|---|---|---|
| Kolesterol Total | < 200 mg/dL | 200–239 | ≥ 240 |
| LDL | < 100 (optimal), 100–129 (mendekati) | 130–159 | 160–189 tinggi; ≥190 sangat tinggi |
| HDL | ≥ 60 (protektif) | 40–59 | < 40 rendah (risiko) |
| Trigliserida | < 150 mg/dL | 150–199 | 200–499 tinggi; ≥500 sangat tinggi |

Catatan implementasi: interpretasi LDL sesungguhnya bergantung risiko kardiovaskular individual (domain dokter) — UI menampilkan band umum + kalimat "target pribadi Anda dapat berbeda, diskusikan dengan dokter".

#### D. Asam Urat — rentang laboratorium umum

| | Normal | Hiperurisemia |
|---|---|---|
| Pria | ≈ 3,5–7,0 mg/dL | > 7,0 |
| Wanita | ≈ 2,6–6,0 mg/dL | > 6,0 |

Klasifikasi sadar-gender (field `sex` di `profiles` — alasan kolom itu ada sejak V1).

### 2.3 Skema Database (tambahan migration)

```sql
-- Rentang klasifikasi ber-versi (data, bukan kode)
create table biomarker_bands (
  id            uuid primary key default gen_random_uuid(),
  biomarker     text not null,          -- bp|glucose|lipid|uric_acid
  parameter     text not null,          -- systolic|diastolic|gdp|gds|hba1c|total|ldl|hdl|tg|uric
  sex           text,                   -- null = berlaku semua
  band_key      text not null,          -- optimal|normal|high_normal|ht1|ht2|ht3|predm|dm|...
  band_label_id text not null,          -- label Bahasa Indonesia
  min_value     numeric,
  max_value     numeric,
  zone          text not null,          -- green|yellow|orange|red|redflag
  guideline_ref text not null,          -- 'Konsensus PERHI/InaSH 2021', 'PERKENI 2021', ...
  version       int not null default 1,
  active        boolean not null default true
);

-- Pembacaan biomarker
create table biomarker_readings (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  biomarker    text not null,           -- bp|glucose|lipid|uric_acid
  values       jsonb not null,          -- bp: {sys:150,dia:95,pulse:78}
                                        -- glucose: {value:180, context:'gds'|'gdp'|'pp2'|'hba1c'}
                                        -- lipid: {total:210,ldl:140,hdl:45,tg:180}
                                        -- uric: {value:7.4}
  classified   jsonb not null,          -- hasil engine: {band_key, zone, guideline_ref, version}
  measured_at  timestamptz not null,
  source       text not null default 'manual',  -- manual|vault_ocr|device (V3)
  vault_doc_id uuid references medical_documents(id),  -- jejak asal jika dari OCR
  note         text,
  client_id    text,
  deleted_at   timestamptz,
  unique (profile_id, client_id)
);

create index idx_biomarker_profile_time
  on biomarker_readings (profile_id, biomarker, measured_at desc);

-- Kondisi terpantau (opsional, diisi user: "saya penderita hipertensi/DM")
create table monitored_conditions (
  profile_id   uuid not null references profiles(id),
  condition    text not null,           -- hypertension|diabetes|dyslipidemia|gout
  monitoring   boolean not null default true,
  target_note  text,                    -- target pribadi dari dokter (mis. TD <130/80)
  created_at   timestamptz not null default now(),
  primary key (profile_id, condition)
);
```

Klasifikasi dihitung di **shared package** (`packages/core/biomarker-engine.ts`) — dipakai client (feedback instan, offline) dan Edge Function (nilai final) dari sumber tabel `biomarker_bands` yang di-cache. Unit test wajib 100% coverage seperti scoring engine.

### 2.4 UI/UX — Tambahan pada Spec v1.0-DS

**Penempatan:** kartu **Risk Panel** baru di Beranda (di bawah kartu Hidrasi/Tidur, di atas disclaimer) + halaman detail per biomarker.

1. **`<RiskPanelCard />`** — ringkasan 4 biomarker dalam satu kartu: ikon + nilai terakhir + chip zona + usia data ("3 hari lalu"). Data > 30 hari → chip berubah "Perlu diperbarui" (abu, bukan merah — jangan menghukum). Belum pernah diisi → empty state edukatif: "Kenali kondisi yang sering tak bergejala — mulai dari tekanan darah."
2. **Input flow tensimeter (< 15 detik):** FAB Quick-Log mendapat aksi kelima 🩺 "Tensi" → sheet dua dial angka besar (sistolik/diastolik, default nilai terakhir ±) + nadi opsional → hasil langsung menampilkan band + edukasi 1 kalimat. Zona 🔴: alur ukur-ulang 5 menit (timer built-in).
3. **Trend chart per biomarker:** garis dengan **pita zona berwarna sebagai latar** (hijau/kuning/oranye/merah) — user melihat posisinya terhadap rentang, bukan sekadar naik-turun. Rentang waktu 30/90/365 hari. Ini visual paling penting modul ini.
4. **Kartu Red-flag** (varian dari red-flag Chat di spec §2.6): border `--ah-score-low`, ikon serius tanpa emoji, dua tombol: "Hubungi 119" + "Catat & ingatkan saya konfirmasi ke dokter" (membuat reminder follow-up otomatis).
5. **Label selalu menyebut sumber:** "Hipertensi Derajat 1 · Konsensus Hipertensi Indonesia 2021" — transparansi standar adalah fitur, bukan catatan kaki.
6. **Warna zona:** memakai token band skor yang ada (`--ah-score-excellent/good/fair/low`) — tanpa token baru.
7. **Microcopy zona (contoh kalibrasi tone):**
   - 🟢 "Tekanan darah Anda di rentang normal. Pertahankan!"
   - 🟡 "Sedikit di atas normal. Kurangi garam dan cek lagi minggu depan."
   - 🟠 "Berada di rentang Hipertensi Derajat 1. Jadwalkan pemeriksaan ke dokter untuk konfirmasi."
   - 🔴 "Angka ini perlu perhatian segera. Istirahat 5 menit, lalu ukur ulang."

### 2.5 Sinergi dengan Modul yang Sudah Ada (Keunggulan vs HealthGuard)

| Modul | Sinergi |
|---|---|
| **Medical Vault (OCR)** | 🔑 *Killer feature*: upload foto hasil lab → OCR mengekstrak GDP/HbA1c/lipid/asam urat → konfirmasi user ("Kami menemukan 4 nilai — tambahkan ke pemantauan?") → masuk `biomarker_readings` dengan `source='vault_ocr'` + tautan ke dokumen asal. Riwayat lab bertahun-tahun jadi grafik dalam satu menit. |
| **Family Health** | Anak memantau tensi orang tua/lansia; notifikasi opsional ke pengelola akun bila anggota keluarga mencatat zona merah (dengan consent anggota — sesuai §7.3 blueprint). |
| **Habit Engine** | Zona 🟡/🟠 → AI Recommendation menawarkan paket habit relevan ("Kurangi garam", "Jalan 30 menit", "Cek tensi tiap Senin") — dari *angka* menjadi *tindakan*. |
| **Medicine Reminder** | Kepatuhan obat antihipertensi/antidiabetes tampil berdampingan dengan trend biomarker — user melihat korelasi kepatuhan vs hasil. |
| **AI Chat** | Konteks biomarker masuk context builder → jawaban personal ("Tren tensi Anda membaik 2 minggu terakhir"). Safety Guard diperluas: pertanyaan dosis obat PTM → selalu diarahkan ke dokter. |
| **ArtaFin** | Pengeluaran obat & kontrol rutin ter-tag medical budget (event bus §9 blueprint). |
| **Program (konten)** | Program baru: "Kendalikan Tensi 30 Hari", "Hidup Sehat dengan Prediabetes" — kurikulum habit + edukasi. |

### 2.6 Perluasan Safety Guard (update blueprint §5.3)

1. Red-flag detector ditambah kategori nilai: TD ≥180/110 (setelah ukur ulang), GDS <70 atau ≥300, nyeri dada + riwayat hipertensi → template tindakan segera, AI tidak beranalisis.
2. AI dilarang: menginterpretasi nilai di luar band engine, menyarankan mulai/stop/ubah dosis obat, menegasikan anjuran konfirmasi dokter.
3. Setiap insight menyentuh biomarker wajib menyertakan frasa konfirmasi medis (di-enforce oleh output guard, bukan sekadar prompt).
4. Onboarding modul menampilkan sekali layar "Apa yang ArtaHealth bisa dan tidak bisa" — kalibrasi ekspektasi sejak awal.

### 2.7 Penempatan Roadmap (revisi)

| Fase | Perubahan |
|---|---|
| **V1.5** *(baru, 3–4 minggu setelah V1)* | Silent Killer Guard inti: input tensi + gula darah manual, klasifikasi engine, Risk Panel, trend chart, red-flag flow. *(Dimajukan dari V2 karena nilai diferensiasi tinggi dan dependensinya kecil — hanya butuh `profiles` + engine.)* |
| **V2** | Lipid & asam urat via input manual + **Vault OCR → biomarker auto-extract**; Family Health notifikasi zona merah; program PTM. |
| **V3** | Tensimeter/glukometer Bluetooth (Web Bluetooth / Health Connect), export "Laporan untuk Dokter" (PDF ringkasan trend — dibawa saat kontrol). |

**"Laporan untuk Dokter"** patut digarisbawahi: satu PDF berisi trend tensi/gula 90 hari + kepatuhan obat, dibawa pasien saat kontrol. Ini menjadikan ArtaHealth *jembatan* pasien–dokter, bukan pesaingnya — posisi yang aman secara regulasi dan bernilai nyata.

---

## 3. Adopsi Standar Non-Fitur dari HealthGuard

1. **Landing page "#story"** — landing ArtaHealth dibangun sebagai narasi (masalah silent killer di keluarga Indonesia → solusi companion) dengan anchor `#cerita`, bukan grid fitur.
2. **Klaim standar yang bisa diaudit** — halaman "Standar & Referensi Klinis" publik yang mencantumkan guideline + versi yang dipakai engine (PERHI/InaSH, PERKENI, referensi lipid) dan tanggal review terakhir. Kejujuran = diferensiasi.
3. **Bahasa penyakit lokal** — istilah yang dipakai masyarakat ("darah tinggi", "gula", "kolesterol", "asam urat") sebagai istilah utama UI, istilah medis sebagai pendamping.

---

## 4. Ringkasan Perubahan pada Dokumen Sebelumnya

| Dokumen | Perubahan |
|---|---|
| Technical Blueprint §1.3 | + modul `biomarkers` (V1.5) |
| Technical Blueprint §3 | + 3 tabel: `biomarker_bands`, `biomarker_readings`, `monitored_conditions` |
| Technical Blueprint §5.3 | Safety Guard diperluas (red-flag nilai, larangan interpretasi obat) |
| Technical Blueprint §12 | + fase V1.5; V2 ditambah OCR-to-biomarker |
| UI/UX Spec §2 | + `<RiskPanelCard />`, sheet input tensi/gula, trend chart pita zona, kartu red-flag nilai |
| UI/UX Spec §3.1 | Beranda + Risk Panel; FAB + aksi 🩺 Tensi |
| UI/UX Spec §5 | + microcopy per zona (pola di §2.4.7 dokumen ini) |
| PRD §14 roadmap | Diselaraskan dengan penempatan V1.5/V2/V3 di atas |

---

## 5. Checklist Sebelum Implementasi Modul Ini

- [ ] Verifikasi seluruh tabel rentang terhadap dokumen guideline terbaru (unduh PDF resmi InaSH/PERKENI/PERKI, simpan di repo `/docs/clinical-refs/` dengan versi)
- [ ] Review konten klasifikasi + microcopy oleh minimal satu tenaga medis (dokter umum cukup untuk tahap ini)
- [ ] Uji red-flag flow end-to-end (termasuk offline — kartu darurat harus tetap muncul tanpa internet)
- [ ] Legal check ringkas: pastikan positioning "edukasi & pencatatan mandiri" konsisten di seluruh copy, ToS, dan store listing (menghindari klasifikasi alat kesehatan)
- [ ] Konten edukasi per kondisi (4 artikel dasar) ditulis dan direview

---

*ArtaHealth mengucapkan terima kasih secara konsep kepada HealthGuard AI — validasi bahwa monitoring silent killer berbahasa Indonesia dibutuhkan. Integrasi ini mengambil semangat dan standarnya, lalu membangunnya di atas fondasi yang lebih luas: Vault, Family, Habit, dan ekosistem Arta.*
