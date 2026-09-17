# Roadmap — Fase 8: Konsolidasi & Retensi (pasca-V3)

Status: **rancangan + increment pertama.** Konteks: V3 (Fase 7) tuntas — banyak fitur baru
dinyalakan sekaligus (Wearable/Katalog/Leaderboard/Radar/SATUSEHAT/QuickLog/Voice), permukaan
produk melebar. Prinsip CONTEXT §4 tetap (deterministik-first, non-diagnosis, flag OFF default).

## 1. Kenapa fase ini (bukan monetisasi dulu)

Gerbang keputusan master-roadmap §5: **retensi divalidasi sebelum monetisasi** ("jika retensi
lemah → tunda Fase 4 monetisasi → fokus retensi"). Setelah meluncurkan 6 fitur backlog, risiko
nyata: dashboard jadi tumpukan kartu, banyak kosong sampai ada data, pengguna bingung/tak kembali.
Fase 8 = **menjadikan yang sudah dibangun sebuah pengalaman yang koheren & lengket**, bukan menambah
fitur baru.

## 2. Tujuan & metrik

- **Retensi harian**: beri alasan jelas untuk membuka app tiap hari (D1/D7 naik).
- **Aktivasi**: pengguna baru mencapai "skor pertama" (3 pencatatan) lebih cepat.
- **Koherensi**: kurangi kebingungan permukaan; sorot yang relevan, sembunyikan yang belum perlu.
- Non-fitur-baru: reuse data & engine yang ada; tak ada klaim medis baru.

## 3. Increment (KR)

- **KR-1 (SEKARANG) — Fokus Hari Ini**: mesin DETERMINISTIK menyarikan 1–3 hal paling relevan dari
  data pengguna hari ini (rentetan di ambang putus, aktivasi skor pertama, log inti yang belum,
  kekurangan hidrasi, atau rayakan bila lengkap). Kartu ringkas di atas Beranda. Reuse Dexie +
  gamification; non-medis. Flag `NEXT_PUBLIC_FEATURE_FOCUS`.
- **KR-2 — Empty-state yang memandu**: tiap kartu fitur (Katalog/Leaderboard/Wearable/…) saat kosong
  mengarahkan ke aksi pertama yang bermakna (bukan sekadar "belum ada data").
- **KR-3 — Organisasi Beranda**: kelompokkan kartu ke bagian berlabel (Hari Ini · Kesehatan · Alat &
  Data) + sembunyikan/lipat alat sekunder → kurangi scroll & beban kognitif.
- **KR-4 — "Apa Baru"**: surface ringan memperkenalkan fitur yang baru dinyalakan ke pengguna lama.
- **KR-5 — Nudge retensi**: perhalus pengingat (reuse push/streak) tanpa spam; ringkasan mingguan.

## 4. Gerbang

- Tanpa klaim medis; semua nudge = aktivasi/motivasi pencatatan, bukan saran kesehatan.
- Tiap increment di balik flag, OFF prod sampai diverifikasi; regresi nol saat mati.
- KR-3 (refactor Beranda) hati-hati: jangan rusak urutan/kondisi kartu yang sudah live.

## 5. Status

- KR-1 = buildable & verifiable sekarang (deterministik, reuse data). Increment berikut menyusul.

Referensi: `docs/master-roadmap.md` (§5 gerbang retensi/monetisasi), `docs/release-checklist-backlog.md`
(track ter-blocked WR-2/SS-2/KC-2/LB-3 — di luar fase ini), CONTEXT §4.
