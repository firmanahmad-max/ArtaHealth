# Gerbang §10 · Paket Review Konten Medis-Puasa & Keislaman (§3.3)

**Tujuan:** memenuhi checklist rilis addendum-ramadan §10 — "Review konten medis-puasa (§3.3) oleh tenaga medis" + "Review konten & istilah keislaman oleh pemeriksa yang kompeten (framing rukhsah, penamaan puasa sunnah, tidak ada klaim fikih yang melampaui yang mapan)." Mode Ramadan **tidak boleh dinyalakan** di produksi sebelum kedua review ini lulus.

## Pagar aplikasi (berlaku menyeluruh — untuk konteks reviewer)

- Aplikasi **tidak pernah** menyarankan waktu/dosis obat, tidak memulai/menghentikan obat, tidak mendiagnosis (CONTEXT §4).
- Semua guidance mengarah ke **konsultasi dokter/apoteker**.
- Status "tidak puasa" **tidak pernah** menanyakan/menyimpan alasan (privasi uzur).
- Seluruh teks di bawah **deterministik** (bukan output AI) dan diambil dari spec addendum.

---

## A. Untuk Tenaga Medis (review akurasi & keamanan medis)

| # | Konteks / kapan muncul | Teks (verbatim) | Lokasi kode | Setuju? | Catatan revisi |
|---|---|---|---|---|---|
| A1 | Aktivasi Mode Ramadan + pengguna memantau diabetes/hipertensi (satu kali) | **"Puasa dengan kondisi Anda"** — "Puasa dengan kondisi Anda umumnya mungkin, namun jadwal obat dan pemantauan perlu disesuaikan — diskusikan dengan dokter sebelum Ramadan." | `packages/core/fasting/safety.ts` → `PRE_RAMADAN_MEDICAL`; komponen `PreRamadanMedicalCard.tsx` | ☐ | |
| A2 | Red-flag hipoglikemia (GDS<70) / krisis hiperglikemia saat hari puasa | **"Keselamatan adalah prioritas — Islam memberikan keringanan (rukhsah) berbuka bagi kondisi darurat medis. Segera tangani, lalu hubungi tenaga medis."** (ditambahkan di bawah panduan darurat "konsumsi 15 g gula cepat… hubungi 119") | `packages/core/fasting/safety.ts` → `RUKHSAH_NOTE`; komponen `RiskPanelCard.tsx` | ☐ | |
| A3 | Jadwal obat yang diisi user jatuh di jam puasa (imsak–maghrib) | **"Jadwal obat [08:00, 13:00] jatuh di jam puasa. Diskusikan penyesuaian dengan dokter/apoteker, lalu perbarui jadwalnya di sini."** | `apps/web/components/MedicationCard.tsx` | ☐ | |
| A4 | Pengingat sahur (push, pra-imsak) | **"Waktu sahur 🌙 — Imsak [04:39] — [60] menit lagi. Sisa target air Anda [750] ml — sempatkan 2 gelas + menu berprotein & berserat."** | `packages/core/fasting/reminders.ts` → `buildSahurReminder` | ☐ | |
| A5 | *(BELUM DIIMPLEMENTASI)* Edukasi: cek gula darah tidak membatalkan puasa (§3.3 baris 4) — menurunkan hambatan monitoring | Rencana teks spec: "Memeriksa gula darah tidak membatalkan puasa (pandangan umum yang mapan)." | — (perlu dibangun setelah disetujui medis **dan** keislaman) | ☐ | |

**Tenaga medis:** ______________ (nama/gelar/SIP)  **Tanda tangan/tanggal:** __________

---

## B. Untuk Pemeriksa Keislaman (framing rukhsah, istilah, klaim fikih)

| # | Konteks | Teks / istilah (verbatim) | Lokasi kode | Setuju? | Catatan revisi |
|---|---|---|---|---|---|
| B1 | Framing rukhsah pada kegawatan medis saat puasa | **"Islam memberikan keringanan (rukhsah) berbuka bagi kondisi darurat medis…"** (lihat A2) | `fasting/safety.ts` → `RUKHSAH_NOTE` | ☐ | |
| B2 | Penamaan jadwal puasa sunnah | Senin–Kamis · Ayyamul Bidh (13–15) · 6 Hari Syawal · Arafah (9 Zulhijah) · Tasu'a–Asyura (9–10 Muharram) · Puasa Daud (selang-seling) | `fasting/hijri.ts` → `SUNNAH_LABELS` | ☐ | |
| B3 | Penamaan bulan Hijriah (tampil di Timeline & kartu sunnah) | Muharram · Safar · Rabiul Awal · Rabiul Akhir · Jumadil Awal · Jumadil Akhir · Rajab · Sya'ban · Ramadan · Syawal · Zulkaidah · Zulhijah | `fasting/hijri.ts` → `HIJRI_MONTHS` | ☐ | |
| B4 | Deteksi hari sunnah (aturan): Ayyamul Bidh = 13–15 Hijriah; Arafah = 9 Zulhijah; Tasu'a–Asyura = 9–10 Muharram; 6 Syawal = hari ke-2 dst | (logika) `fasting/hijri.ts` → `sunnahFastingOn` | ☐ | |
| B5 | *(BELUM DIIMPLEMENTASI)* Klaim fikih "cek gula darah tidak membatalkan puasa" (lihat A5) — perlu konfirmasi ini "pandangan mapan", bukan klaim melampaui | — | ☐ | |
| B6 | Konfirmasi konversi Hijriah **tabular** (±1–2 hari) hanya untuk tampilan/saran; tanggal krusial (awal Ramadan/Syawal) selalu dikonfirmasi user — tidak ada penetapan tanggal ibadah oleh aplikasi | `fasting/hijri.ts` (komentar), `RamadanSetupCard` | ☐ | |

**Pemeriksa keislaman:** ______________  **Tanda tangan/tanggal:** __________

---

## Setelah kedua review lulus

1. Terapkan revisi teks yang diminta (edit di lokasi kode tercantum + `packages/core` bila deterministik).
2. Jalankan langkah launch Fase 3: (a) lembar imsakiyah `gate-imsakiyah-validation.md` lulus, (b) `db push` migrasi fasting/obat (sudah), (c) deploy Edge Function `send-reminders` (versi sahur), (d) set `NEXT_PUBLIC_FEATURE_RAMADAN=1` (+ `NEXT_PUBLIC_FEATURE_MEDICATION=1` bila obat diikutkan) di Vercel, (e) redeploy.
3. Uji privasi §10: pastikan tak ada jalur UI/analytics/log yang menyimpan alasan `not_fasting`.
