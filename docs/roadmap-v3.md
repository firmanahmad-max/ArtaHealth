# Rancangan V3 (Fase 7) — ArtaHealth

Status: **DRAFT rancangan** (belum dibangun) · Disusun 23 Agu 2026 · Horizon: H2 2027
Prasyarat: Fase 1–6 live + Ramadan (Fase 3/5) live + retensi tervalidasi.

> Dokumen ini = **peta V3** (urutan, gerbang, dependensi, keputusan arsitektur) + **deep-dive
> fitur pertama** (Mode Konsultasi QR + Laporan Dokter). Prinsip tak berubah: deterministik
> dulu, fitur paling jarang-salah dulu, kepercayaan sebagai kompas.

---

## 1. Visi & posisi V3

V1–V2 membangun **companion harian** (catat, skor, biomarker, gizi, puasa, keluarga, gamifikasi).
V3 mengubahnya jadi **penghubung ke dunia kesehatan nyata**: data pasif dari perangkat, jembatan
ke tenaga medis, pertahanan terhadap hoaks, dan wawasan lintas-metrik. Tema V3: *"dari mencatat
diri → memahami & bertindak bersama pihak lain (dokter, perangkat, komunitas)."*

## 2. Prinsip yang dibawa (tak berubah)

- **Deterministik dulu, AI kemudian.** Fitur baru pun: engine di `packages/core` + test, AI hanya ekstraksi/narasi.
- **Bukan diagnosis / bukan alat medis.** Framing edukatif; laporan = ringkasan data, bukan interpretasi klinis.
- **Data kesehatan = T1** (CONTEXT §3.5): enkripsi + bucket privat + signed URL pendek; tak pernah ke log/analytics.
- **Aditif + feature flag**; regresi nol saat mati.
- **Satu work-stream besar** pada satu waktu (aturan kapasitas roadmap §2).

## 3. Keputusan arsitektur BESAR — PWA vs native (gating wearable)

Sampai Fase 6 ArtaHealth **murni PWA** (roadmap §7). Wearable/Health Connect **memaksa** keputusan:

- **Health Connect (Android)** & **HealthKit (iOS)** hanya bisa diakses dari aplikasi **native** — PWA/Web tak punya API-nya (Web hanya punya Web Bluetooth terbatas, tak setara).
- Opsi: (a) **TWA/Capacitor bungkus PWA jadi APK** → dapat plugin Health Connect, kode web tetap dipakai ulang; (b) **native penuh** (mahal, buang investasi PWA); (c) **tunda wearable, pakai impor manual/file** (mis. unggah export Google Fit) sebagai jembatan sementara.
- **Rekomendasi:** saat fase wearable tiba → **Capacitor** (bungkus PWA, tambah plugin Health Connect/HealthKit), rilis via Play Store; PWA tetap kanal utama. Keputusan ini **tidak** menghalangi fitur V3 lain yang tak butuh perangkat → **jangan** jadikan wearable increment pertama.

## 4. Urutan V3 yang diusulkan

| # | Fitur | Nilai | Effort | Risiko | Butuh sumber data baru? | Dependensi |
|---|---|---|---|---|---|---|
| **V3-1** | **Mode Konsultasi QR + Laporan Dokter** | Sangat tinggi (kepercayaan) | Sedang | Rendah–sedang (privasi berbagi) | Tidak (reuse) | Fase 2/4/6 data |
| V3-2 | Simulasi "Bagaimana Jika" | Tinggi (retensi/motivasi) | Sedang | Sedang | Tidak (engine skor) | scoring/biomarker |
| V3-3 | AI korelasi lintas-metrik + report bulanan | Tinggi | Sedang–tinggi | Sedang (klaim korelasi) | Tidak | ≥60 hari data |
| V3-4 | Cek Klaim Kesehatan (anti-hoaks) | Tinggi (sosial) | Tinggi | **Tinggi** (misinformasi) | Tidak (AI+rujukan) | ArtaBot, gerbang konten |
| V3-5 | Kesehatan Siklus (menstruasi) | Tinggi (segmen) | Sedang | Sedang (sensitif) | Tidak | profil, privasi |
| V3-6 | Jadwal Imunisasi Anak | Sedang | Rendah–sedang | Rendah | Tidak (jadwal IDAI) | Family Health |
| V3-7 | **Health Connect / Wearable** | Sangat tinggi (leverage) | **Tinggi** (native) | Tinggi (platform) | **Ya** | keputusan §3 |

**Alasan urutan:** mulai dari yang **reuse data + jarang-salah + kepercayaan tinggi** (V3-1), lanjut
yang memperdalam nilai data (V3-2, V3-3), baru yang berisiko konten (V3-4) & butuh perubahan
platform (V3-7). Wearable sengaja **terakhir** meski leverage tinggi — ia menahan keputusan native
yang mahal; fitur lain tak boleh tersandera olehnya.

## 5. Gerbang keputusan V3

| Kapan | Pertanyaan | Jika gagal |
|---|---|---|
| Sebelum V3-1 | Retensi pasca-Ramadan sehat? Ada permintaan "bawa ke dokter"? | Fokus retensi core dulu |
| Sebelum V3-4 (anti-hoaks) | Ada proses review konten medis + sumber rujukan tepercaya? | Tunda — risiko misinformasi > nilai |
| Sebelum V3-7 (wearable) | Siap rilis native (Capacitor+Play Store, maintenance)? | Pakai impor manual dulu (§3c) |
| Sebelum tiap fitur | Bisa deterministik? Data kesehatan aman (T1)? | Redesain sampai bisa |

---

## 6. Deep-dive — V3-1: Mode Konsultasi QR + Laporan Dokter

### 6.1 Tujuan & batas
Membuat **ringkasan kesehatan yang rapi & bisa dibagi** untuk dibawa ke konsultasi dokter —
menjadikan data yang sudah dicatat pengguna **berguna di momen klinis nyata**. **Bukan diagnosis,
bukan interpretasi klinis** — hanya menyajikan data + tren apa adanya, dengan rujukan guideline yang
sudah dipakai app (PERKENI/PERHI/dst). Dokter yang menafsirkan.

### 6.2 Isi laporan (semua REUSE — tanpa sumber data baru)
- **Identitas ringkas**: nama, usia, jenis kelamin, kondisi yang dipantau (`monitored_conditions`).
- **Biomarker + tren**: `biomarker_readings` (tensi/gula/lipid/asam urat) — nilai terkini, riwayat, klasifikasi zona + `guideline_ref` (engine Fase 2).
- **Early Warning**: geseran baseline signifikan (engine Fase 6 #4) — "berat tren naik z=…".
- **Obat**: daftar `medications` + kepatuhan minum (`medication_intakes`) — TANPA saran dosis (CONTEXT §4).
- **Gaya hidup ringkas**: rata-rata tidur/hidrasi/aktivitas + Health Score tren (read-model scoring).
- **Gizi (opsional)**: rata-rata GGL vs anjuran (Fase 4) bila relevan.
- **Dokumen lab**: daftar `medical_documents` (Vault) sebagai rujukan (bukan isinya di QR).
- **Disclaimer permanen** + tanggal rentang laporan.

### 6.3 Arsitektur (deterministik)
- **`packages/core/consultation-report.ts`** — engine murni: input = kumpulan data (biomarker series,
  meds, EW report, score series, dst) → output = **struktur laporan ternormalisasi** (`ConsultationReport`)
  + ringkasan tren deterministik. **Unit-test penuh** (tanpa AI). AI opsional hanya untuk 1 paragraf
  narasi ringkas (fallback template bila AI mati).
- **Render**: dari struktur → **HTML cetak/print-friendly** (client-side) → bisa di-*print to PDF*
  browser. Tanpa lib berat.

### 6.4 Mekanisme berbagi — bertahap (privasi dulu)
Data laporan = **T1 sensitif** → mekanisme berbagi adalah titik risiko utama. Bertahap:

- **MK-1 (MVP, paling aman): on-screen + cetak.** Laporan dibuat **client-side** dari Dexie, tampil
  di layar untuk ditunjukkan ke dokter / *print to PDF*. **Tak ada data ke server, tak ada link.**
  Nol permukaan kebocoran. (QR belum, atau QR hanya berisi deep-link buka-app tanpa data.)
- **MK-2 (handoff digital): signed share link + QR, TTL pendek + revocable.** Snapshot laporan
  disimpan **terenkripsi** (pgsodium, tabel `consultation_reports`, bucket privat) → server terbitkan
  **signed URL TTL 30–60 mnt**, **revocable**, tampilan **read-only** (tanpa login dokter). **QR = URL
  itu** (bukan data mentah). Ikut aturan T1 (CONTEXT §3.5). Butuh **gerbang review privasi/keamanan**.
- **DIHINDARI**: QR yang mengenkode **data kesehatan mentah** langsung (bisa difoto layar → bocor
  permanen; ukuran QR juga terbatas). QR hanya untuk **pointer** ke sumber terkontrol.

### 6.5 Privasi & keamanan (T1)
- Snapshot terenkripsi; **tak ada PII di URL/query** (token acak); TTL pendek; tombol **cabut akses**.
- Signed URL tak bisa ditebak; akses read-only; identitas ArtaHealth ringan sebagai sumber + watermark/disclaimer "disiapkan pemilik akun via ArtaHealth, bukan dokumen medis resmi".
- Data kesehatan tak pernah masuk log/analytics/Sentry (§5.3). Snapshot auto-hapus setelah kedaluwarsa.
- Consent eksplisit pengguna tiap kali membuat link ("laporan ini bisa dibuka siapa pun yang punya link selama X menit").

### 6.6 Data model
- **MK-1**: TANPA tabel baru (generate on-the-fly dari Dexie).
- **MK-2**: migration baru `consultation_reports` (id, profile_id, encrypted_payload, created_at,
  expires_at, revoked_at) + RLS + bucket privat bila lampiran. Masuk `SYNC_TABLES`? **Tidak** — snapshot
  server-side, bukan data yang disinkron ke Dexie (hindari kompleksitas).

### 6.7 Increment
- **MK-1** ← **MVP terpilih**: engine `consultation-report.ts` (+ test) + `lib/consultation.ts` (rakit dari Dexie profil aktif, **rentang default 90 hari**) + `ConsultationReportCard`/halaman cetak (identitas ArtaHealth ringan sebagai sumber + disclaimer non-diagnosis) + flag `NEXT_PUBLIC_FEATURE_CONSULTATION`. On-screen/print. **Tanpa migrasi.**
- **MK-2** ← **SELESAI di kode** (flag OFF, GERBANG belum lewat): migration `0024_consultation_reports` (snapshot terenkripsi, token, TTL, revoke, RLS) + Edge Function `consultation-share` (create/revoke, JWT user) + `consultation-view` (baca publik via token, service-role) + enkripsi AES-GCM (`_shared/report-crypto.ts`, secret `CONSULTATION_ENC_KEY`) + `lib/consultation-share.ts` + QR (lib `qrcode`) di `ConsultationReportCard` + halaman publik `/r/[token]`. **Langkah rilis (tugas Firman): db-push 0024 + set secret `CONSULTATION_ENC_KEY` (base64 32 byte) + deploy 2 fungsi + GERBANG privasi/keamanan §6.8 → baru nyalakan.** Runtime-untested s/d deploy (tak bisa diuji lokal tanpa Supabase).
- **MK-3**: narasi ringkas AI (opsional, fallback template) + pilihan rentang tanggal + pilih bagian yang disertakan.
- **MK-4**: integrasi Family (buat laporan untuk anggota, dengan izin) + lampiran dokumen Vault (signed).

### 6.8 Gerbang sebelum flag nyala
1. **Review konten medis**: framing laporan benar-benar non-interpretatif; label guideline akurat; disclaimer memadai.
2. **Review privasi/keamanan** (khusus MK-2): mekanisme signed URL/TTL/enkripsi/revoke diaudit; uji kebocoran.
3. **Uji dokter nyata**: apakah formatnya berguna & terbaca di ruang praktik?

### 6.9 Keputusan (terkunci 23 Agu 2026)
- **MVP = MK-1 on-screen/print dulu** (tanpa server/tabel/link) → QR share (MK-2) menyusul setelah gerbang privasi.
- **Rentang default laporan = 90 hari** (cukup tampilkan tren bermakna; selaras Early Warning).
- **Framing = identitas ArtaHealth ringan** (nama/logo kecil sebagai sumber) + disclaimer non-diagnosis; TIDAK menyerupai dokumen medis resmi.

Siap dibangun: **MK-1**.

---

## 7. Backlog V3 lain (diparkir, tinjau saat pergantian increment)
Radar Sehat (AQI/heat/DBD) · Katalog produk komunal · SATUSEHAT · Leaderboard · Voice via Arta
Assistant · Cek Klaim (bila gerbang konten siap). Aturan backlog roadmap §6 berlaku.

Referensi: `docs/master-roadmap.md` (§Fase 7), `docs/technical-blueprint.md` (§3 skema, §11 billing),
addendum Fase 2/4/6 (sumber data laporan).
