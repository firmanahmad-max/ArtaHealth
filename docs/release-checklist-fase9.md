# Checklist Rilis — Fase 9 (Persiapan Ramadan 2027)

Owner: Firman. Fitur musiman — **aktif hanya saat Mode Ramadan menyala (~Feb 2027)** & inert di luar
musim. Semua kode SELESAI & MERGE ke main (kecuali RW-4 Paket Ramadan = blocker bisnis). Rilis =
**lewati gerbang (imsakiyah + isbat)** → **backend (db-push + deploy fungsi)** → **nyalakan flag
musiman + redeploy**. Prinsip CONTEXT §4 + gerbang keislaman/medis Fase 3 §10 tetap.

## 1. Ringkasan

| Item | Flag | Backend perlu | Gerbang | Status |
|---|---|---|---|---|
| **Mode Ramadan inti** (Fase 3) | `NEXT_PUBLIC_FEATURE_RAMADAN` (+`_MEDICATION`) | migrasi 0013–0015 ✅ push · `send-reminders` deploy (lihat RW-5) | §10 Kemenag+medis ✅ (ulang verif imsakiyah 2027 → RW-3) | siap, musiman |
| **RW-1 Ramadan Wrapped** | `NEXT_PUBLIC_FEATURE_RAMADAN_WRAPPED` | — | — | nyalakan saat musim |
| **RW-2 Readiness pra-Ramadan** | `NEXT_PUBLIC_FEATURE_RAMADAN_READINESS` | — | — | nyalakan pra-musim |
| **RW-3 Verifikasi imsakiyah 2027** | — (bukan fitur; gerbang) | — | **WAJIB**: diff app vs Kemenag ±2mnt + tanggal final isbat | **alat siap; verif = Firman** |
| **RW-4 Paket Ramadan** | — | — | keputusan + provider pembayaran | **belum dibangun (blocker bisnis)** |
| **RW-5 Pengingat berbuka/iftar** | (ikut `_RAMADAN`) | **migrasi 0027 db-push** + **deploy `send-reminders`** | — | tinggal db-push 0027 + deploy |

## 2. Gerbang (lewati SEBELUM nyala)

- [ ] **RW-3 imsakiyah 2027**: ambil jadwal resmi Kemenag → diff vs tabel app (`docs/imsakiyah-2027-verifikasi.md`) pakai `compareImsakiyah` → **semua ≤ ±2 menit** (`allWithin`). Bila meleset, tinjau `time_correction`/metode.
- [ ] **Tanggal final (sidang isbat)**: perbarui `ramadanStart/ramadanEnd` setelah isbat (tabel di §1 masih perkiraan 18 Feb–19 Mar 2027). Ulangi diff imsakiyah dgn tanggal final.
- [x] Gerbang Fase 3 §10 (Kemenag + review medis/keislaman) sudah LEWAT untuk engine inti.

## 3. Backend (jalankan yang relevan)

- [ ] **RW-5 pengingat iftar** — migrasi 0027 (`'iftar'` ke `check(kind)` reminder_log):
  ```bash
  npx supabase db push
  ```
  (tanpa ini, insert dedup 'iftar' ditolak → pengingat berbuka tak pernah terkirim.)
- [ ] **Deploy fungsi pengingat** (sudah memuat blok sahur + iftar):
  ```bash
  npx supabase functions deploy send-reminders
  ```
  (secret VAPID + `send-reminders` cron sudah disiapkan sejak Fase 3; deploy ulang untuk kode iftar.)

## 4. Nyalakan flag di Vercel (Production) + redeploy

Nyalakan saat musim (set `=1`, lalu **redeploy** — flag build-time).

- [ ] `NEXT_PUBLIC_FEATURE_RAMADAN=1` (+ `NEXT_PUBLIC_FEATURE_MEDICATION=1` bila dipakai)
- [ ] `NEXT_PUBLIC_FEATURE_RAMADAN_READINESS=1` (pra-musim: countdown + checklist)
- [ ] `NEXT_PUBLIC_FEATURE_RAMADAN_WRAPPED=1` (recap; tampil saat ada data puasa dalam rentang)

> Catatan: RW-5 (iftar) ikut Mode Ramadan — tak ada flag web terpisah; aktif setelah 0027 di-push +
> fungsi di-deploy + pengguna mengaktifkan Ramadan & set lokasi.

## 5. Smoke test (musim)

- [ ] **Readiness**: aktifkan Ramadan dgn tanggal masa depan + set lokasi → kartu "🌙 Menuju Ramadan"
      muncul (H-N + checklist; item jadi ✅ saat lokasi/medis/obat dilengkapi).
- [ ] **Imsakiyah**: saat hari puasa, kartu imsakiyah menampilkan imsak/subuh/maghrib sesuai verif §2.
- [ ] **Pengingat**: `send-reminders` kirim **sahur** (pra-imsak) & **berbuka** (pra-maghrib) sekali/hari;
      cek `reminder_log` berisi kind `sahur` & `iftar`; push diterima di perangkat uji.
- [ ] **Wrapped**: setelah beberapa hari (atau akhir Ramadan), kartu "🌙 Ramadan Wrapped" menampilkan
      hari puasa/rentetan/% sesuai data; non-menghakimi.
- [ ] Tanpa error konsol.

## 6. Rollback

- Fitur ber-flag (Wrapped/Readiness): set `=0` + redeploy → hilang, regresi nol.
- Pengingat iftar: tak ada flag web; bila perlu dimatikan, redeploy `send-reminders` versi tanpa blok
  iftar (atau nonaktifkan Mode Ramadan). Data `reminder_log` aman.
- Mode Ramadan: `NEXT_PUBLIC_FEATURE_RAMADAN=0` + redeploy → seluruh pengalaman puasa nonaktif.

## 7. Follow-up (tersandera = Firman)

- **RW-4 Paket Ramadan** — fitur premium musiman; butuh keputusan + integrasi provider pembayaran
  (gerbang bisnis). Framing/UI bisa dibangun saat arah ditentukan.

Referensi: `docs/roadmap-fase9.md`, `docs/release-checklist-ramadan.md` (rilis Mode Ramadan Fase 3),
`docs/imsakiyah-2027-verifikasi.md` (gerbang RW-3).
