# Addendum — Wearable / Health Connect (V3-7)

Status: **DRAFT desain teknis** (belum dibangun) · Disusun 26 Agu 2026 · Flag: `NEXT_PUBLIC_FEATURE_WEARABLE` (OFF)

> Fitur dengan **leverage tertinggi** di V3 (data pasif → memberi makan skor, Early Warning,
> korelasi, laporan) TAPI **effort & risiko tertinggi**: memaksa keputusan **PWA → native**.
> Sengaja ditaruh terakhir. Dokumen ini menetapkan arsitektur, skema, increment, dan gerbang —
> bukan izin langsung koding native. **Spike WR-0 wajib lulus dulu.**

## 1. Tujuan & batas

Menarik data kesehatan pasif dari perangkat/wearable pengguna (langkah, detak jantung, tidur,
energi, berat) via **Health Connect (Android)** & **HealthKit (iOS)** → mengisi otomatis apa
yang kini dicatat manual, meningkatkan akurasi skor & deteksi dini.

**BUKAN**: bukan alat medis; angka wearable = perkiraan perangkat (akurasi bervariasi). Tak
menggantikan pengukuran klinis. Tak menulis balik ke Health Connect/HealthKit (read-only MVP).

## 2. Masalah inti: PWA tak bisa akses Health Connect/HealthKit

- **Health Connect** (Android) & **HealthKit** (iOS) hanya dapat diakses aplikasi **native**;
  Web/PWA tak punya API-nya (Web Bluetooth terbatas & tak setara).
- ArtaHealth sampai V3 = **murni PWA** (roadmap §7). Wearable **memaksa** shell native.

## 3. Keputusan arsitektur — Capacitor (bungkus PWA)

**Pilihan: Capacitor** (roadmap-v3 §3). Membungkus build web yang SUDAH ada menjadi APK/IPA,
menambah akses native via plugin. **Web tetap kanal utama; kode web dipakai ulang 100%.**

- **Zero regression web**: pengguna PWA/web tak terpengaruh. Kapabilitas native dijaga
  `Capacitor.isNativePlatform()` — di web, jalur wearable inert (seperti flag mati).
- **Plugin Health Connect / HealthKit**: pakai plugin komunitas bila matang (mis.
  `@capacitor-community/health`, `capacitor-health-connect`) atau **plugin kustom tipis** bila
  perlu kontrol/keandalan. **Risiko kematangan plugin = alasan utama spike WR-0.**
- **Rilis**: Play Store (Android dulu) → App Store (iOS menyusul). Perlu akun developer,
  proses review (data kesehatan = kebijakan ketat), signing, dan pemeliharaan rilis native.

Alternatif yang DITOLAK: native penuh (buang investasi PWA), TWA murni (tak beri akses Health
Connect), impor file manual (jembatan sementara, bukan solusi).

## 4. Alur data (read-only)

```
Health Connect / HealthKit  →  plugin native  →  bridge JS (isNativePlatform)
   →  normalisasi (unit, zona waktu, dedup)  →  Dexie `wearable_samples` (offline-first)
   →  rollup harian deterministik  →  dikonsumsi aggregateDayInputs / Early Warning / korelasi
   →  outbox → Supabase (sync antar-perangkat)
```

- **Permission & consent**: minta izin Health Connect per jenis data; layar penjelasan tujuan
  (data kesehatan T1). Pengguna bisa cabut kapan saja; hormati penolakan (inert).
- **Rentang tarik**: awal = 30 hari ke belakang, lalu inkremental (simpan `lastSyncAt`).
- **Frekuensi**: saat app dibuka + (WR-5) background periodic bila plugin mendukung.

## 5. Skema data (usulan)

**Tabel BARU `wearable_samples`** (raw/teragregasi, ber-sumber) — hindari mengubah tabel log
manual yang sudah stabil:

| kolom | isi |
|---|---|
| `id` | uuid (idempoten) |
| `profile_id` | pemilik |
| `type` | `steps` \| `heart_rate` \| `sleep` \| `active_energy` \| `weight` \| `spo2` |
| `value` | angka (mis. langkah/hari, bpm, menit tidur) |
| `unit` | satuan |
| `start_at` / `end_at` | rentang sampel |
| `source` | `health_connect` \| `healthkit` |
| `external_id` | id sampel platform (DEDUP — cegah dobel saat re-sync) |
| `created_at/updated_at/deleted_at` | standar sync |

RLS per pemilik akun; id-keyed; masuk SYNC_TABLES (pola cycle_logs). `external_id` unik per
profil untuk idempotensi.

**Integrasi ke skor tanpa dobel-hitung**: rollup harian memilih **satu sumber per metrik/hari**
— prioritas wearable > manual bila keduanya ada (atau sebaliknya, sesuai keputusan produk) —
supaya `aggregateDayInputs` tak menjumlahkan langkah wearable + langkah manual. Metrik tanpa
padanan tabel manual (detak jantung istirahat, SpO₂) → dipakai Early Warning/korelasi langsung.
**Tak mengubah** `activity_logs`/`sleep_logs`/`weight_logs` (provenance tetap jelas).

## 6. Privasi & keamanan (T1)

- Data kesehatan wearable = T1: RLS, tak pernah ke log/analytics/Sentry (§5.3).
- Consent eksplisit + granular (per jenis data); tampilkan apa yang ditarik & mengapa.
- Read-only (tak menulis ke Health Connect); tak membagikan ke pihak ketiga.
- Kepatuhan kebijakan store untuk data kesehatan (Google Play Health Connect policy, Apple
  HealthKit guidelines) — bagian gerbang.

## 7. Increment

- **WR-0 (SPIKE, wajib lulus dulu)**: scaffold Capacitor + baca **langkah** dari Health Connect
  di **≥2 device Android nyata**. Ukur keandalan plugin, izin, akurasi vs manual. *Gagal → tahan
  fitur / pertimbangkan impor manual.*
- **WR-1**: integrasi Capacitor ke repo (build APK dari web yang ada) + `isNativePlatform` guard;
  web tetap jalan. CI/build native (opsional di CI).
- **WR-2**: migration `wearable_samples` + Dexie + sync + plugin Android baca langkah+tidur →
  rollup + dedup + UI izin/consent + kartu status sinkron.
- **WR-3**: detak jantung istirahat + energi → Early Warning/korelasi memakainya.
- **WR-4**: paritas iOS HealthKit.
- **WR-5**: background sync + penyempurnaan konflik sumber.

## 8. GERBANG sebelum flag/rilis

1. **Spike WR-0 lulus**: plugin andal + izin bekerja + akurasi memadai di device menengah.
2. **Uji device lintas OEM** (Samsung/Xiaomi/Oppo dll) + versi Android/Health Connect.
3. **Kebijakan store**: lolos review data kesehatan (Play/App Store); privasi & consent sesuai.
4. **Keputusan produk**: prioritas sumber (wearable vs manual) & dampak ke skor final.
5. **Kesiapan operasional**: pipeline rilis native (signing, versioning, update) & pemeliharaan.

Jika gerbang tak terpenuhi → tahan; jembatan sementara = **impor file** (mis. export Google Fit)
tanpa native.

## 9. Risiko & keputusan terbuka

- **Kematangan plugin** Health Connect/HealthKit (risiko utama) → spike menentukan build vs beli.
- **Beban rilis native** (dua platform, review store, maintenance) — komitmen berkelanjutan.
- **Dobel-hitung** manual vs wearable → aturan prioritas sumber (buka utk keputusan Firman).
- **iOS lebih lambat** (HealthKit + App Store) → Android dulu.

## 10. Status

- Dokumen desain ini = pijakan. **Belum ada kode.** Langkah pertama nyata = **WR-0 spike**
  (butuh device Android + akun developer) — keputusan & sumber daya di sisi Firman.

Referensi: `docs/roadmap-v3.md` (§3 keputusan PWA-vs-native, §4 V3-7), CONTEXT §4 (keselamatan),
`docs/addendum-rppg.md` (pola spike fitur berisiko).
