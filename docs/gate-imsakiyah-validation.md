# Gerbang §10 · Lembar Validasi Imsakiyah vs Kemenag

**Tujuan:** memenuhi checklist rilis addendum-ramadan §10 — "Verifikasi perhitungan waktu imsak/maghrib vs jadwal imsakiyah Kemenag untuk ≥5 kota (termasuk Samarinda), toleransi ±2 menit, sediakan koreksi manual." Fitur Mode Ramadan **tidak boleh dinyalakan** di produksi sebelum lembar ini lulus.

## Metode

1. Ambil jadwal resmi Kemenag per kota & tanggal dari **bimasislam.kemenag.go.id/jadwalshalat** (atau aplikasi resmi Kemenag).
2. Bandingkan dengan **waktu hasil hitung aplikasi** (tabel di bawah — engine `packages/core/fasting/prayer-times.ts`, sudut Kemenag Subuh 20° / Isya 18°).
3. Isi kolom Kemenag & **Selisih** (menit; app − Kemenag).
4. Bila |selisih| > 2 menit untuk **imsak** atau **maghrib** (dua batas puasa), setel **koreksi ihtiyati** di aplikasi (kartu Jadwal Imsakiyah → "Koreksi ihtiyati") sebesar −selisih, lalu cek ulang sampai ≤ ±2 menit.
5. Koreksi bisa berbeda per kota; simpan nilai final di kolom terakhir sebagai rekomendasi default.

> Fokus wajib: **imsak** (batas mulai puasa) & **maghrib** (berbuka). Subuh & Isya dicek untuk kelengkapan salat.

## Catatan akurasi

Engine murni astronomis; Kemenag menambah **ihtiyati** (~+2 mnt untuk subuh/dzuhur/asar/maghrib/isya, dan imsak = subuh − 10). Selisih sistematis ~2 menit **normal** dan justru ditutup oleh koreksi ihtiyati — itulah gunanya lembar ini. Anchor terverifikasi: 1 Ramadan 1448 ≈ 8 Feb 2027.

---

## A. Ramadan 1448 — contoh 18 Feb 2027 (validasikan vs jadwal Ramadan resmi saat terbit)

Waktu hasil hitung aplikasi:

| Kota | TZ | Imsak (app) | Kemenag | Selisih | Maghrib (app) | Kemenag | Selisih | Subuh (app) | Isya (app) | Koreksi final |
|---|---|---|---|---|---|---|---|---|---|---|
| Jakarta | +7 | 04:29 | ____ | ___ | 18:15 | ____ | ___ | 04:39 | 19:26 | imsak __ / maghrib __ |
| Bandung | +7 | 04:25 | ____ | ___ | 18:13 | ____ | ___ | 04:35 | 19:24 | imsak __ / maghrib __ |
| Surabaya | +7 | 04:04 | ____ | ___ | 17:52 | ____ | ___ | 04:14 | 19:03 | imsak __ / maghrib __ |
| Medan | +7 | 05:10 | ____ | ___ | 18:40 | ____ | ___ | 05:20 | 19:50 | imsak __ / maghrib __ |
| Pontianak | +7 | 04:25 | ____ | ___ | 18:00 | ____ | ___ | 04:35 | 19:10 | imsak __ / maghrib __ |
| **Samarinda** | +8 | 04:53 | ____ | ___ | 18:29 | ____ | ___ | 05:03 | 19:39 | imsak __ / maghrib __ |
| Makassar | +8 | 04:39 | ____ | ___ | 18:24 | ____ | ___ | 04:49 | 19:35 | imsak __ / maghrib __ |
| Banjarmasin | +8 | 05:01 | ____ | ___ | 18:42 | ____ | ___ | 05:11 | 19:52 | imsak __ / maghrib __ |

## B. Cek silang cepat — 14 Agustus 2026 (jadwal Kemenag sudah tersedia sekarang)

Untuk memvalidasi metode segera tanpa menunggu jadwal Ramadan 2027:

| Kota | TZ | Imsak (app) | Kemenag | Selisih | Maghrib (app) | Kemenag | Selisih |
|---|---|---|---|---|---|---|---|
| Jakarta | +7 | 04:31 | ____ | ___ | 17:54 | ____ | ___ |
| Bandung | +7 | 04:29 | ____ | ___ | 17:51 | ____ | ___ |
| Surabaya | +7 | 04:08 | ____ | ___ | 17:30 | ____ | ___ |
| Medan | +7 | 04:53 | ____ | ___ | 18:37 | ____ | ___ |
| Pontianak | +7 | 04:15 | ____ | ___ | 17:51 | ____ | ___ |
| **Samarinda** | +8 | 04:44 | ____ | ___ | 18:19 | ____ | ___ |
| Makassar | +8 | 04:40 | ____ | ___ | 18:05 | ____ | ___ |
| Banjarmasin | +8 | 04:57 | ____ | ___ | 18:26 | ____ | ___ |

---

## Hasil

- [ ] ≥5 kota (termasuk Samarinda) selisih imsak & maghrib ≤ ±2 menit (setelah koreksi ihtiyati bila perlu)
- [ ] Nilai koreksi ihtiyati default per kota dicatat (bila perlu bawa ke kode sebagai preset kota)
- [ ] Uji lintas zona waktu WIB/WITA/WIT (checklist §10)

**Divalidasi oleh:** ______________  **Tanggal:** __________

> Bila engine perlu penyesuaian sistematis (bukan sekadar ihtiyati per-kota), catat di sini dan buat isu — koreksi engine masuk `packages/core/fasting/prayer-times.ts`.
