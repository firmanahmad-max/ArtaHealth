# Checklist Keputusan & Rilis — Lanjutan Backlog (Wearable WR-2 · SATUSEHAT SS-2 · Katalog KC-2 · Leaderboard LB-3)

Owner: Firman. Keempat fitur ini sudah punya **fondasi deterministik yang MERGE ke main & inert di
prod** (WR-1 · SS-1 · KC-1 · LB-1 — engine teruji + kartu di balik flag OFF). Dokumen ini = apa
yang perlu **kamu putuskan / sediakan** (blocker eksternal) lalu **langkah rilis** untuk membawa
bagian berikutnya hidup. Setiap lanjutan tersandera blocker di luar kode — begitu dibuka, bagian
"Bangun (kode)" bisa saya kerjakan.

> Prinsip tetap: deterministik-first, semua di balik flag (OFF prod default), data kesehatan T1,
> non-diagnosis. Flag build-time → **wajib redeploy Vercel** tiap ubah flag. Gerbang lewat dulu,
> baru nyala publik.

## Ringkasan

| Lanjutan | Blocker utama (milikmu) | Perlu backend | Gerbang | Estimasi kerja kode |
|---|---|---|---|---|
| **Wearable WR-2** (native Health Connect) | Device Android nyata + akun Google Play developer + keputusan Capacitor | migrasi 0026 ✅ sudah push · plugin native | WR-0 spike lulus + uji device lintas-OEM + kebijakan store | Besar (native/Capacitor) |
| **SATUSEHAT SS-2** (sync jaringan) | Registrasi organisasi Kemenkes (Client ID/Secret/Org ID) | Edge Function `satusehat-sync` + secret | Consent pasien + verifikasi peta kode + audit keamanan | Sedang |
| **Katalog KC-2** (komunal termoderasi) | Keputusan produk (izinkan tulis komunal?) + kesiapan moderasi | tabel `product_catalog` + Edge Function kontribusi | Gerbang konten (anti-spam + review ahli gizi) | Sedang |
| **Leaderboard LB-3** (papan sosial) | Keputusan produk (papan sosial di app kesehatan?) | tabel `leaderboard_entries` + Edge Function | Gerbang privasi (opt-in/pseudonim/moderasi/anti-cheat) | Sedang |

Urutan disarankan bila mau bertahap: **SS-2** (nilai portabilitas resmi, blocker administratif jelas)
→ **KC-2** (perluasan Sadar Gizi yang sudah live) → **LB-3/WR-2** (keputusan produk lebih berat /
beban native). Tak ada ketergantungan teknis antar-keempatnya.

---

## 1. Wearable WR-2 — native Health Connect/HealthKit

**Flag:** `NEXT_PUBLIC_FEATURE_WEARABLE` · **Fondasi:** WR-1 (`core/wearable.ts`, migrasi 0026,
Dexie v15, `lib/wearable.ts` guard `isWearableNativeReady`, `WearableCard`) · Desain:
`docs/addendum-wearable.md`.

### Keputusan (kamu)
- [ ] Setuju bungkus PWA jadi APK via **Capacitor** (web tetap utama, native dijaga `isNativePlatform`)?
- [ ] Komitmen rilis native (signing, versioning, maintenance 2 platform bila iOS menyusul)?

### Prasyarat (kamu sediakan)
- [ ] ≥2 device Android nyata (idealnya OEM beda: Samsung/Xiaomi/Oppo) + Health Connect terpasang.
- [ ] Akun Google Play developer (untuk review kebijakan data kesehatan / distribusi).

### Bangun (kode — saya, saat dibuka)
- [ ] **WR-0 spike**: scaffold Capacitor + plugin Health Connect baca **langkah** di device nyata;
      ukur keandalan/izin/akurasi vs manual. *Gagal → tahan / pertimbangkan impor file.*
- [ ] Bridge native memanggil `ingestWearableSamples()` (sudah ada) → dedup/rollup/sync jalan.
- [ ] UI izin/consent granular per jenis data; `WearableCard` tampilkan rollup nyata.
- [ ] (WR-3) detak/energi → Early Warning/korelasi; (WR-4) paritas iOS HealthKit; (WR-5) background sync.

### Backend / rilis
- [x] Migrasi 0026 `wearable_samples` sudah di-push (15 Sep 2026).
- [ ] Build & tanda-tangani APK; jalur rilis native.

### Gerbang sebelum flag nyala (`docs/addendum-wearable.md §8`)
- [ ] Spike WR-0 lulus (plugin andal + izin bekerja + akurasi memadai).
- [ ] Uji device lintas-OEM + versi Android/Health Connect.
- [ ] Lolos review kebijakan data kesehatan (Play/App Store).
- [ ] Keputusan prioritas sumber (wearable vs manual) & dampak ke skor final (`chooseSource`).
- [ ] Kesiapan operasional rilis native.

### Nyalakan & smoke
- [ ] `NEXT_PUBLIC_FEATURE_WEARABLE=1` (APK) → kartu tampil rollup harian dari device.
- [ ] Cek tak dobel-hitung (langkah wearable vs manual) di skor.
- **Rollback:** matikan flag / distribusikan build tanpa flag; web tetap inert (regresi nol).

---

## 2. SATUSEHAT SS-2 — sinkronisasi jaringan (FHIR)

**Flag:** `NEXT_PUBLIC_FEATURE_SATUSEHAT` · **Fondasi:** SS-1 (`core/fhir.ts` pemetaan FHIR R4,
`lib/satusehat.ts` ekspor `.json`, `SatuSehatCard`) · Desain: `docs/addendum-satusehat.md`.

### Keputusan (kamu)
- [ ] **Arah utama**: ekspor/push (kirim data ke faskes) **atau** impor/pull (tarik rekam medis
      resmi pengguna)? Fondasi FHIR agnostik arah; UI spesifik menyusul setelah keputusan ini.

### Prasyarat (kamu sediakan — blocker administratif)
- [ ] **Registrasi organisasi SATUSEHAT** (onboarding Kemenkes) → `SATUSEHAT_CLIENT_ID`,
      `SATUSEHAT_CLIENT_SECRET`, `SATUSEHAT_ORG_ID` (mulai dari sandbox → staging → produksi).
- [ ] Alur consent pasien + IHS Number (bila push data pasien).

### Bangun (kode — saya, saat kredensial ada)
- [ ] Edge Function `satusehat-sync`: OAuth2 client-credentials → dapat token → POST `/Bundle`
      (push) / GET resource (pull). Token di server, **tak pernah** di bundel web.
- [ ] Wire tombol kartu ke fungsi (bukan hanya unduh `.json`).
- [ ] (SS-4) Immunization concept map CVX/SATUSEHAT bila imunisasi disertakan.

### Backend / rilis
- [ ] Set secret Supabase: `SATUSEHAT_CLIENT_ID/SECRET/ORG_ID` (+ base URL sandbox/prod).
- [ ] `npx supabase functions deploy satusehat-sync`.
- [ ] (Bila simpan status kirim) migrasi kecil log sinkron — opsional.

### Gerbang sebelum flag nyala (`§7`)
- [ ] Kredensial produksi + kebijakan data kesehatan & retensi.
- [ ] Verifikasi peta kode (LOINC/UCUM lab; CVX/SATUSEHAT imunisasi) oleh nakes.
- [ ] Audit keamanan token/scope; uji sandbox → staging → produksi.

### Nyalakan & smoke
- [ ] `NEXT_PUBLIC_FEATURE_SATUSEHAT=1` + redeploy → ekspor `.json` tetap jalan (SS-1) + sync jaringan aktif.
- [ ] Round-trip sandbox: build Bundle → POST → 200/valid; (pull) GET → petakan balik.
- **Rollback:** matikan flag; ekspor offline (SS-1) tetap tersedia tanpa jaringan.

---

## 3. Katalog KC-2 — katalog komunal termoderasi

**Flag:** `NEXT_PUBLIC_FEATURE_CATALOG` · **Fondasi:** KC-1 (`core/product-catalog.ts` normalisasi +
konsensus median + cari, `lib/product-catalog.ts` katalog lokal, `ProductCatalogCard`) · Desain:
`docs/addendum-katalog.md`.

### Keputusan (kamu)
- [ ] Izinkan **tulis komunal** (pengguna menyumbang produk ke pool bersama)? Baca-saja dulu vs
      baca+tulis.
- [ ] Kapasitas **moderasi** (siapa/otomatis) tersedia?

### Prasyarat (kamu sediakan)
- [ ] Kebijakan konten & pelaporan; ambang sembunyikan entri; kontak moderasi.

### Bangun (kode — saya, saat diputuskan)
- [ ] Migrasi `product_catalog` (baca komunal, **tulis via Edge Function** — bukan tulis-langsung klien).
- [ ] Edge Function kontribusi: konsensus median server (reuse `consensusNutrition`) + `sanityCheck`
      gizi + rate-limit + status moderasi (`flagged`/`hidden`).
- [ ] `lib/product-catalog.ts`: baca katalog komunal + gabung dgn lokal; tombol "sumbang" (opt-in).
- [ ] (KC-3) barcode (input manual/kamera) sebagai identitas kuat.

### Backend / rilis
- [ ] `npx supabase db push` (tabel `product_catalog`).
- [ ] `npx supabase functions deploy catalog-contribute` (+ secret bila perlu).

### Gerbang sebelum tulis-komunal publik (`§3/§6`)
- [ ] Moderasi/anti-spam operasional; konsensus + sanity memadai; rate-limit + audit.
- [ ] Review ahli gizi atas dampak entri komunal ke verdict pengguna.

### Nyalakan & smoke
- [ ] `NEXT_PUBLIC_FEATURE_CATALOG=1` (sudah bisa untuk katalog lokal) → tambah baca komunal setelah backend.
- [ ] Uji: kontribusi buruk (outlier) tak menggeser konsensus; entri di-flag tersembunyi.
- **Rollback:** matikan tulis komunal (kembali baca-lokal); katalog lokal tetap jalan.

---

## 4. Leaderboard LB-3 — papan sosial pseudonim

**Flag:** `NEXT_PUBLIC_FEATURE_LEADERBOARD` · **Fondasi:** LB-1 (`core/leaderboard.ts` ranking +
bucket mingguan + momentum, `lib/leaderboard.ts` papan pribadi lokal, `LeaderboardCard`) · Desain:
`docs/addendum-leaderboard.md`.

### Keputusan (kamu)
- [ ] Adakan papan **sosial** di aplikasi kesehatan? (risiko tekanan sosial — pertimbangkan LB-2
      papan RUMAH dulu, dalam consent Family Health, sebelum papan publik.)

### Prasyarat (kamu sediakan)
- [ ] Kebijakan privasi papan sosial + moderasi nama tampil + kebijakan anak/rentan.

### Bangun (kode — saya, saat diputuskan)
- [ ] **LB-2** (opsional dulu): papan RUMAH — rank anggota Family Health (poin turunan), lokal/akun.
- [ ] **LB-3**: migrasi `leaderboard_entries` (`handle` pseudonim, `period_key`, `points`); Edge
      Function tulis (validasi/rate-limit/anti-cheat) + baca agregat peringkat.
- [ ] UI: opt-in eksplisit, pilih handle pseudonim, opsi sembunyi/opt-out & hapus.

### Backend / rilis
- [ ] `npx supabase db push` (tabel `leaderboard_entries`).
- [ ] `npx supabase functions deploy leaderboard-submit` (+ anti-cheat).

### Gerbang sebelum flag sosial nyala (`§3`)
- [ ] Opt-in + pseudonim; **hanya poin turunan** dibagi (tak pernah nilai/kondisi kesehatan).
- [ ] Moderasi nama tampil; anti-cheat (validasi poin server, rate-limit); opt-out & hapus.

### Nyalakan & smoke
- [ ] `NEXT_PUBLIC_FEATURE_LEADERBOARD=1` (papan pribadi sudah bisa) → papan sosial setelah backend+gerbang.
- [ ] Uji: hanya poin (bukan data kesehatan) terkirim; handle pseudonim; opt-out menghapus entri.
- **Rollback:** matikan papan sosial (kembali papan pribadi lokal); tak ada data sosial tersisa bila opt-out.

---

## Catatan lintas-fitur

- **Semua flag build-time** → tiap `=1`/`=0` butuh **redeploy Vercel**.
- **Data T1** (wearable/SATUSEHAT/kesehatan) tak pernah ke log/analytics/Sentry.
- **Regresi nol**: tiap fitur inert saat flag OFF; fondasi yang sudah merge tak mengubah alur live.
- Referensi: `docs/release-checklist-v3.md` (fitur inti V3), addendum masing-masing fitur.
