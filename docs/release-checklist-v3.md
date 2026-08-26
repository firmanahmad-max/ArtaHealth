# Checklist Rilis — V3 (Fase 7)

Owner: Firman · Semua fitur inti V3-1..V3-6 **SELESAI DI KODE & MERGE ke main**. Semua di balik
feature flag (**OFF di prod** kecuali disebut). Dokumen ini = apa yang perlu dilakukan **per
fitur** untuk membawanya LIVE: migrasi / deploy fungsi / secret / gerbang / nyalakan flag.

> Prinsip: fitur nyala hanya setelah backend siap (migrasi di-push, fungsi ter-deploy) & gerbang
> lewat. Flag build-time → **wajib redeploy Vercel** setiap mengubah flag.

## Ringkasan per fitur

| Fitur | Flag | Backend perlu | Gerbang | Status |
|---|---|---|---|---|
| **V3-1 Konsultasi (MK-1)** laporan on-screen/print | `NEXT_PUBLIC_FEATURE_CONSULTATION` | — | — | siap nyala |
| **V3-1 Konsultasi (MK-2)** share QR/link | (flag sama) | migrasi 0024 ✅push · deploy `consultation-share`+`consultation-view` ✅ · secret `CONSULTATION_ENC_KEY` ✅ | **gerbang privasi §6.8** (audit token/TTL/enkripsi/revoke) sebelum publik | backend siap; smoke-test prod LULUS; tinggal gerbang privasi utk publik |
| **V3-2 Simulasi What-If** | `NEXT_PUBLIC_FEATURE_WHATIF` | — (deterministik) | — | siap nyala |
| **V3-3 Laporan Bulanan + korelasi** | `NEXT_PUBLIC_FEATURE_MONTHLY` | — (deterministik) | — | siap nyala |
| **V3-4 Cek Klaim (CK-1/2/3)** | `NEXT_PUBLIC_FEATURE_CEK_KLAIM` | deploy `claim-check` (reuse secret `SUMOPOD_*`/`AI_MODEL`) | gerbang konten ✅ LEWAT (kurasi sumber+review medis) | tinggal deploy `claim-check` + smoke test |
| **V3-5 Kesehatan Siklus** | `NEXT_PUBLIC_FEATURE_CYCLE` | **migrasi 0025 WAJIB db-push** (masuk SYNC_TABLES) | — (data sensitif; sudah RLS) | tinggal db-push 0025 |
| **V3-6 Imunisasi Anak** | `NEXT_PUBLIC_FEATURE_IMMUNIZATION` | — (state lokal `meta`) | **verifikasi jadwal vs IDAI** (schedule = kerangka) | tinggal verifikasi IDAI |
| **V3-7 Wearable** | `NEXT_PUBLIC_FEATURE_WEARABLE` | belum ada kode | WR-0 spike + keputusan native (Capacitor) | desain saja |

## Langkah backend (jalankan yang relevan)

- [ ] **Siklus** — migrasi 0025:
  ```bash
  npx supabase db push
  ```
  (remote harus sinkron s/d 0025; tanpa ini, `pullAll` prod error saat menarik `cycle_logs`.)
- [ ] **Cek Klaim** — deploy Edge Function:
  ```bash
  npx supabase functions deploy claim-check
  ```
  (secret `SUMOPOD_*`/`AI_MODEL` sudah ada dari fitur AI lain.)
- [x] **Konsultasi MK-2** — migrasi 0024 di-push, `consultation-share`/`consultation-view` deploy, secret `CONSULTATION_ENC_KEY` set, smoke-test round-trip LULUS.

## Gerbang sebelum nyala publik

- [ ] **Konsultasi MK-2** (§6.8): audit signed-token/TTL/enkripsi/revoke + review teks → aman dibagikan pengguna nyata. (MK-1 on-screen/print tak butuh gerbang ini.)
- [x] **Cek Klaim** — gerbang konten (kurasi sumber resmi + review medis) LEWAT.
- [ ] **Imunisasi** — verifikasi `IMMUNIZATION_SCHEDULE` vs jadwal IDAI terbaru (review).

## Nyalakan flag di Vercel (Production) + redeploy

Nyalakan yang backend & gerbangnya siap. Set `=1`, lalu **redeploy**.

- [ ] `NEXT_PUBLIC_FEATURE_WHATIF=1` (siap)
- [ ] `NEXT_PUBLIC_FEATURE_MONTHLY=1` (siap)
- [ ] `NEXT_PUBLIC_FEATURE_CONSULTATION=1` (MK-1 siap; MK-2 share aktif setelah gerbang privasi)
- [ ] `NEXT_PUBLIC_FEATURE_CYCLE=1` (setelah db-push 0025)
- [ ] `NEXT_PUBLIC_FEATURE_IMMUNIZATION=1` (setelah verifikasi IDAI)
- [ ] `NEXT_PUBLIC_FEATURE_CEK_KLAIM=1` (setelah deploy `claim-check`)
- [ ] `NEXT_PUBLIC_FEATURE_WEARABLE` — belum (WR-0 spike dulu)

## Smoke test prod (per fitur yang dinyalakan)

- [ ] Beranda menampilkan kartu fitur yang diaktifkan (tanpa error konsol).
- [ ] **Konsultasi**: buat laporan → tampil; (MK-2) Bagikan → buka `/r/<token>` di perangkat lain → cabut.
- [ ] **What-If / Bulanan**: kartu menghitung dari data akun; sembunyi/anggun saat data minim.
- [ ] **Siklus**: catat tanggal haid → prediksi muncul; sinkron ke perangkat kedua (cek `cycle_logs`).
- [ ] **Imunisasi**: isi tgl lahir → status; tandai sudah → persist.
- [ ] **Cek Klaim**: klaim berisiko → "Perlu kehati-hatian" (gerbang); klaim wajar → penilaian AI + sumber; chat "benarkah…?" → hint Cek Klaim.
- [ ] **Regresi**: pengguna tanpa flag / fitur lama LIVE tak terpengaruh.

## Rollback

- [ ] Set flag terkait `=0` + redeploy → kartu hilang; data & migrasi tetap utuh (skema aditif, RLS).
- [ ] Fungsi Edge (`claim-check`) tak perlu di-rollback (inert saat flag mati; hanya dipanggil dari fitur ber-flag).

## Catatan

- **322 core test** hijau; semua engine deterministik ber-flag.
- Flag build-time: **wajib redeploy** Vercel tiap ubah.
- Musiman/menunggu keputusan: **Ramadan** (Fase 3, checklist terpisah), **Wearable** (WR-0 spike), **rPPG** (Fase 6 #3 gerbang §7).

Referensi: `docs/roadmap-v3.md`, `docs/addendum-cek-klaim.md`, `docs/addendum-wearable.md`, `docs/release-checklist-ramadan.md`.
