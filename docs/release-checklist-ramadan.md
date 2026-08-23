# Checklist Rilis — Mode Ramadan (Fase 3)

Owner: Firman · Target musim: **Ramadan 1448 H ≈ Feb 2027** · Deadline live: **~pertengahan Jan 2027**

> Fitur musiman. UI Ramadan jalan **client-side** (nyala begitu flag di-set); Edge Function
> `send-reminders` khusus **push sahur**. Semua kode sudah di `main`. Ceklis ini = urutan aman
> dari "gerbang lewat" → "live di produksi".

---

## 0. Prasyarat (sudah selesai — verifikasi ✔)

- [x] Fitur Fase 3 lengkap di `main` (RM-1…RM-4b + puasa sunnah + modul obat).
- [x] **Gerbang §10 LEWAT** — validasi imsakiyah vs Kemenag (±2 mnt) + review konten medis/keislaman §3.3 (23 Agu 2026).
- [x] Migrasi **0013 / 0014 / 0015** sudah `db push` (remote sinkron; tabel `fasting_*`, `medications`, `reminder_log` kind `sahur` siap).
- [ ] Konfirmasi tanggal 1 Ramadan 1448 H final (sidang isbat) untuk `RamadanSetupCard` (anchor tabular ≈ 8 Feb 2027; ±1–2 hari → dikonfirmasi user).

## 1. Pra-rilis — verifikasi kode & konfigurasi

- [ ] CI hijau di `main` (termasuk `deno check` semua Edge Function).
- [ ] Secret produksi Supabase ter-set untuk `send-reminders`: **`VAPID_PUBLIC_KEY`**, **`VAPID_PRIVATE_KEY`**, `VAPID_SUBJECT` (mailto:…). *(Sama dengan yang dipakai push Fase 1 — push reguler sudah live, jadi mestinya sudah ada.)*
  ```bash
  npx supabase secrets list
  ```
- [ ] Env produksi Vercel punya `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (untuk subscribe push di klien — sudah ada sejak Fase 1).
- [ ] pg_cron pemanggil `send-reminders` masih aktif (migration 0009, tiap jam).

## 2. Deploy Edge Function `send-reminders`

Cron saat ini memanggil **versi lama** (tanpa blok sahur). Deploy memperbaruinya.
Blok sahur **inert** bila flag mati / tak ada `fasting_days` hari ini / koordinat kosong → aman.

- [ ] Deploy:
  ```bash
  npx supabase functions deploy send-reminders
  ```
- [ ] Konfirmasi status **ACTIVE** (versi baru) di dashboard Supabase → Edge Functions.
- [ ] Cek log tak error pada pemanggilan cron berikutnya (sahur blok ter-skip di luar musim = normal).

## 3. Nyalakan feature flag di Vercel

- [ ] Set `NEXT_PUBLIC_FEATURE_RAMADAN=1` (Production).
- [ ] *(Opsional)* Set `NEXT_PUBLIC_FEATURE_MEDICATION=1` — modul obat + deteksi konflik jadwal saat puasa (§3.3). Nyalakan bila mau modul obat ikut rilis.
- [ ] **Redeploy** Vercel (flag build-time → wajib redeploy agar terbaca).

## 4. Smoke test produksi (setelah redeploy)

**UI (client-side, tak butuh musim Ramadan):**
- [ ] Buka Beranda → muncul `RamadanHeader` (countdown "Ramadan sebentar lagi" / countdown berbuka-imsak) & `RamadanSetupCard`.
- [ ] `ImsakiyahCard`: pilih kota (incl. Samarinda) → jadwal imsak→isya tampil; GPS & koreksi ihtiyati menggeser waktu + countdown.
- [ ] Bandingkan imsak/maghrib 1–2 kota vs jadwal Kemenag → selisih ≤ ±2 mnt (gerbang §10 sudah lewat; ini sanity akhir).
- [ ] Toggle "Tandai puasa" → badge 🌙 di Health Ring + skor pakai normalisasi puasa; reload → status persist; toggle off → revert (tanpa tanya alasan — privasi by design).
- [ ] `SunnahScheduleCard`: pilih jadwal (mis. Senin-Kamis) → ajakan puasa muncul di hari cocok.
- [ ] *(bila MEDICATION on)* `MedicationCard`: tambah obat dgn dosis jam puasa → badge konflik ⚠️ + pesan §3.3; dosis di luar jam puasa aman.
- [ ] *(bila diabetes/hipertensi dipantau)* `PreRamadanMedicalCard` interstitial muncul saat mode puasa → acknowledge → hilang.

**Sync & regresi:**
- [ ] Perangkat kedua (akun sama) → status puasa & setting tersinkron (`fasting_settings`/`fasting_days`).
- [ ] Pengguna non-Ramadan (flag OFF di akun lain / sebelum redeploy) tak terpengaruh (regresi nol).

**Push sahur (butuh kondisi puasa aktif):**
- [ ] Aktifkan Ramadan + tandai puasa hari ini + izinkan notifikasi + set koordinat.
- [ ] Pada jendela pra-imsak `[imsak − sahur_reminder_min, imsak)`, cron mengirim 1 push sahur (konten personal: imsak + sisa air + saran). *Dedup: sekali per hari per profil via `reminder_log` kind `sahur`.*
- [ ] *(uji cepat di luar jam)* Set koordinat/koreksi agar jendela sahur jatuh dekat waktu uji, atau cek log `send-reminders` mengonfirmasi jalur sahur ter-evaluasi.

## 5. Pemantauan pasca-rilis (minggu pertama)

- [ ] Sentry: zero error kritis dari komponen Ramadan / `send-reminders`.
- [ ] Log `send-reminders`: tak ada lonjakan error; push sahur terkirim sesuai jendela; tak ada duplikat.
- [ ] `pullAll` produksi lancar (tabel `fasting_*`/`medications` tak bikin error siklus sync).
- [ ] Dogfood (RM-5): jalankan sendiri via puasa sunnah Senin-Kamis sebelum musim Ramadan.

## 6. Rollback (bila ada masalah)

- [ ] **Cepat & aman:** set `NEXT_PUBLIC_FEATURE_RAMADAN=0` (+`MEDICATION=0`) di Vercel + redeploy → seluruh UI Ramadan hilang; data & migrasi tetap utuh (tabel inert).
- [ ] Push sahur: blok sahur otomatis inert saat flag mati / tak ada `fasting_days` → tak perlu rollback fungsi. Bila perlu, redeploy versi `send-reminders` sebelumnya.
- [ ] Tak ada rollback migrasi yang diperlukan (skema aditif, kolom nullable).

---

## Lampiran — ringkas

| Item | Nilai |
|---|---|
| Flag utama | `NEXT_PUBLIC_FEATURE_RAMADAN=1` (Vercel, Production, redeploy) |
| Flag opsional | `NEXT_PUBLIC_FEATURE_MEDICATION=1` |
| Edge Function | `npx supabase functions deploy send-reminders` |
| Secret wajib | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Migrasi | 0013/0014/0015 — sudah di-push (tak ada aksi) |
| Anchor Hijriah | 1 Ramadan 1448 H ≈ 8 Feb 2027 (konfirmasi sidang isbat) |
| Rollback | flag → 0 + redeploy (data aman) |

**Jalur minimum** (kalau mau UI dulu, push sahur menyusul): lompat ke **§3 + §4-UI**. `send-reminders` (§2) bisa di-deploy belakangan tanpa memblok fitur inti.

Referensi: `docs/addendum-ramadan.md`, `docs/gate-imsakiyah-validation.md`, `docs/gate-content-review-33.md`.
