# Verifikasi Imsakiyah Ramadan 2027 (Fase 9 · RW-3 · GERBANG)

Owner: Firman. **Gerbang Fase 3 §10**: imsak/subuh/maghrib app harus cocok dengan jadwal **resmi
Kemenag** dalam **±2 menit** sebelum Mode Ramadan dinyalakan untuk musim 2027. Dokumen ini berisi
**sisi-app** (dihasilkan engine `computePrayerTimes`, metode `KEMENAG_PARAMS`) + cara men-diff.

> ⚠️ **Tanggal Ramadan 2027 masih PERKIRAAN astronomis** (18 Feb – 19 Mar 2027). Final menunggu
> **sidang isbat** Kemenag. Perbarui tanggal di bawah setelah isbat, lalu ulangi verifikasi.

## 1. Jadwal app (perkiraan 2027) — imsak · subuh · maghrib

Sampel 3 tanggal (awal · tengah · akhir) × 7 kota (3 zona waktu). Waktu lokal zona masing-masing.

| Kota (zona) | Tanggal | Imsak | Subuh | Maghrib |
|---|---|---|---|---|
| Jakarta (WIB) | 2027-02-18 | 04:29 | 04:39 | 18:15 |
| Jakarta (WIB) | 2027-03-05 | 04:30 | 04:40 | 18:10 |
| Jakarta (WIB) | 2027-03-19 | 04:30 | 04:40 | 18:04 |
| Bandung (WIB) | 2027-02-18 | 04:25 | 04:35 | 18:13 |
| Bandung (WIB) | 2027-03-05 | 04:27 | 04:37 | 18:07 |
| Bandung (WIB) | 2027-03-19 | 04:27 | 04:37 | 18:01 |
| Surabaya (WIB) | 2027-02-18 | 04:04 | 04:14 | 17:52 |
| Surabaya (WIB) | 2027-03-05 | 04:06 | 04:16 | 17:47 |
| Surabaya (WIB) | 2027-03-19 | 04:06 | 04:16 | 17:40 |
| Medan (WIB) | 2027-02-18 | 05:10 | 05:20 | 18:40 |
| Medan (WIB) | 2027-03-05 | 05:08 | 05:18 | 18:39 |
| Medan (WIB) | 2027-03-19 | 05:03 | 05:13 | 18:36 |
| Makassar (WITA) | 2027-02-18 | 04:39 | 04:49 | 18:24 |
| Makassar (WITA) | 2027-03-05 | 04:41 | 04:51 | 18:19 |
| Makassar (WITA) | 2027-03-19 | 04:40 | 04:50 | 18:14 |
| Denpasar (WITA) | 2027-02-18 | 04:52 | 05:02 | 18:44 |
| Denpasar (WITA) | 2027-03-05 | 04:55 | 05:05 | 18:38 |
| Denpasar (WITA) | 2027-03-19 | 04:56 | 05:06 | 18:31 |
| Jayapura (WIT) | 2027-02-18 | 04:17 | 04:27 | 17:57 |
| Jayapura (WIT) | 2027-03-05 | 04:17 | 04:27 | 17:53 |
| Jayapura (WIT) | 2027-03-19 | 04:15 | 04:25 | 17:48 |

*(Imsak = subuh − 10 menit, sesuai konvensi Kemenag. Angka dari engine yang sudah lolos gerbang
Fase 3 §10; dihitung ulang untuk tanggal 2027.)*

## 2. Cara verifikasi (±2 menit)

1. Ambil jadwal **resmi Kemenag 2027** untuk kota-kota di atas (bimasislam.kemenag.go.id / aplikasi
   resmi), tanggal yang sama (setelah isbat gunakan tanggal final).
2. Bandingkan per baris imsak/subuh/maghrib. Gerbang **LULUS** bila semua selisih **≤ ±2 menit**.
3. Untuk pengecekan terotomasi, pakai engine pembanding `@arta/core`:

```ts
import { compareImsakiyah, parseHHMM } from "@arta/core";

// isi refMinutes dari jadwal Kemenag (tempel "HH:MM" → parseHHMM)
const result = compareImsakiyah([
  { label: "Jakarta 2027-02-18 imsak",   appMinutes: parseHHMM("04:29")!, refMinutes: parseHHMM("04:30")! },
  { label: "Jakarta 2027-02-18 maghrib", appMinutes: parseHHMM("18:15")!, refMinutes: parseHHMM("18:15")! },
  // … baris lain
]);
console.log(result.allWithin, result.maxAbsDelta, result.mismatches);
```

`allWithin === true` → gerbang lolos. Bila ada mismatch, tiap baris `withinTolerance:false` + `deltaMin`
menunjukkan kota/tanggal yang meleset → tinjau koreksi waktu (`timeCorrection` per lokasi) atau metode.

## 3. Setelah lulus

- Konfirmasi tanggal final (isbat) di `fasting_settings` / kartu setup.
- Nyalakan `NEXT_PUBLIC_FEATURE_RAMADAN` (+ `_MEDICATION`, `_RAMADAN_WRAPPED`, `_RAMADAN_READINESS`)
  di Vercel + redeploy (musiman). Lihat `docs/release-checklist-ramadan.md`.

Referensi: `packages/core/fasting/prayer-times.ts` (engine), `fasting/imsakiyah-verify.ts` (pembanding),
`docs/roadmap-fase9.md`, `docs/release-checklist-ramadan.md`.
