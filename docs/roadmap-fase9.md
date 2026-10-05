# Roadmap — Fase 9: Persiapan Ramadan 2027

Status: **rancangan + increment pertama.** Konteks: Mode Ramadan inti (Fase 3) SUDAH LENGKAP &
teruji — imsakiyah Kemenag, kalibrasi skor puasa, sahur, obat+konflik, puasa sunnah; flag
`NEXT_PUBLIC_FEATURE_RAMADAN` tinggal dinyalakan musiman (~Feb 2027). Fase ini **bukan** membangun
ulang inti, melainkan **menyiapkan musim**: delight/retensi (Wrapped), penyempurnaan readiness,
verifikasi tanggal 2027, dan jembatan ke Paket Ramadan (monetisasi). Prinsip CONTEXT §4 + gerbang
keislaman/medis Fase 3 tetap.

## 1. Kenapa fase ini sekarang

Ramadan 2027 ≈ Februari 2027 — jangkar musiman dengan deadline riil. Menyiapkan 4–5 bulan di muka
memberi ruang untuk uji akurasi (imsakiyah 2027), live-ops (pengingat/cron), dan fitur musiman yang
menaikkan retensi & membuka momen "Paket Ramadan". Semua bagian deterministik bisa dibangun kini;
yang tersandera (pembayaran Paket Ramadan) = keputusan bisnis Firman.

## 2. Increment (RW)

- **RW-1 (SEKARANG) — Ramadan Wrapped**: rekap akhir bulan puasa DETERMINISTIK (hari berpuasa,
  rentetan terpanjang, % penyelesaian, tingkat/headline) dari `fasting_days` dalam rentang Ramadan.
  Delight + shareable + retensi. Reuse engine streak Fase 3. Flag `NEXT_PUBLIC_FEATURE_RAMADAN_WRAPPED`.
  Non-medis, non-menghakimi (alasan sah: sehat/safar/haid).
- **RW-2 — Readiness pra-Ramadan**: perhalus kartu persiapan (countdown + checklist sahur/obat/
  hidrasi + konfirmasi tanggal sidang isbat) agar aktivasi mulus saat H-.
- **RW-3 — Verifikasi imsakiyah 2027 (GERBANG)**: validasi jadwal imsak/maghrib 2027 vs Kemenag
  (±2 mnt) sebelum musim. Keputusan/sumber Firman (gerbang Fase 3 §10).
- **RW-4 — Paket Ramadan (hook)**: titik tempat fitur premium musiman nanti dipasang (framing +
  UI), integrasi pembayaran = blocker bisnis Firman.
- **RW-5 — Live-ops**: kesiapan `send-reminders` (sahur/berbuka) + secret + smoke-test push musiman.

## 3. Gerbang

- Non-medis & hormat keislaman (lanjut gerbang Fase 3 §10: Kemenag + review medis/keislaman).
- Wrapped non-menghakimi: completion rendah tetap diframing hangat (alasan sah tak ditanya/dicatat).
- Tiap increment di balik flag, OFF prod sampai musim & verifikasi; regresi nol saat mati.

## 4. Status

- RW-1 = buildable & verifiable sekarang (deterministik, reuse data puasa). Siap dipakai saat
  Ramadan 2027 berjalan/berakhir. Increment lain menyusul.

Referensi: `docs/release-checklist-ramadan.md` (rilis Mode Ramadan Fase 3), `docs/master-roadmap.md`
(§8 jangkar Ramadan, §5 gerbang PRO/Paket Ramadan), CONTEXT §4.
