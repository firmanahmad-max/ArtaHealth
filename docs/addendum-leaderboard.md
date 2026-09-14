# Addendum — Leaderboard (Backlog V3)

Status: **desain + fondasi engine + papan PRIBADI-temporal (LB-1) — papan sosial (LB-3) tunggu
gerbang privasi + backend.** Indeks: `docs/roadmap-v3.md §7`. Melengkapi **Gamification** (Fase 6 #6,
`gamification.ts`). Prinsip CONTEXT §4 (keselamatan, deterministik-first, non-diagnosis) penuh.

## 1. Ringkasan

Leaderboard = peringkat berbasis poin. Untuk aplikasi **kesehatan**, membandingkan aktivitas
dengan **orang lain** bukan fitur netral: bisa menekan, memicu perbandingan tak sehat, dan
membocorkan pola aktivitas. Karena itu papan **sosial** (LB-3) diperlakukan sebagai fitur berisiko
dengan gerbang privasi — sedangkan yang bernilai & aman **sekarang** adalah papan **pribadi**:
peringkat poin mingguanmu terhadap **minggu-minggumu sendiri** (rekor pribadi, momentum), tanpa
data apa pun keluar dari perangkat.

## 2. Sumber poin (reuse Gamification)

Poin diturunkan DETERMINISTIK dari aktivitas yang sudah dicatat (habit, log gaya hidup, biomarker,
scan gizi) memakai `XP_RULES` (`packages/core/gamification.ts`). Leaderboard TIDAK membuat metrik
baru — hanya **mem-bucket poin per minggu** lalu memeringkat. Tak pernah memakai NILAI kesehatan
(mis. angka tensi) sebagai skor — hanya poin aktivitas turunan.

## 3. Privasi & keamanan (papan sosial = berisiko)

- **LB-1 papan pribadi**: 100% lokal (Dexie), tak ada data keluar perangkat. Aman tanpa gerbang.
- **LB-3 papan sosial** perlu SEMUA berikut sebelum flag: **opt-in eksplisit**; identitas
  **pseudonim** (nama tampil pilihan, bukan nama asli/akun); **hanya poin turunan** yang dibagi
  (tak pernah nilai/kondisi kesehatan); **moderasi nama tampil** (anti-abuse); **anti-cheat**
  (rate-limit, validasi poin server); **opt-out & hapus** kapan saja; kebijakan untuk anak/rentan.
- Perbandingan sosial bisa memberi tekanan → framing lembut, non-kompetitif berlebihan, dan opsi
  menyembunyikan diri. Bukan diagnosis, bukan penilaian harga-diri.

## 4. Arsitektur (deterministik-first)

```
Aktivitas tercatat (Dexie)  → poin per-event (XP_RULES)
  → packages/core/leaderboard.ts  (bucket mingguan + ranking) — MURNI/TERUJI
  → [LB-1] papan PRIBADI: minggu ini vs minggu-minggu lalumu (rekor pribadi, delta) — LOKAL
  → [LB-2] papan RUMAH (anggota keluarga, dalam consent Family Health) — opsional
  → [LB-3] papan SOSIAL pseudonim (backend + opt-in + moderasi) — di balik flag+gerbang
```

## 5. Skema (LB-3, usulan)

**Tabel `leaderboard_entries`** (opt-in): `{ handle (pseudonim), period_key, points, updated_at }`.
Tulis lewat Edge Function (validasi/rate-limit), baca agregat peringkat. TANPA profile_id yang
bisa mengidentifikasi; TANPA nilai kesehatan. Retensi & hapus atas permintaan.

## 6. Increment & GERBANG

- **LB-1 (SEKARANG)**: `leaderboard.ts` (rankEntries + bucket mingguan + rekor/delta) teruji;
  papan PRIBADI dari Dexie di balik flag `NEXT_PUBLIC_FEATURE_LEADERBOARD`. **Tanpa backend.**
- **LB-2**: papan RUMAH (anggota Family Health) — masih dalam consent rumah tangga.
- **LB-3**: papan SOSIAL pseudonim (tabel + Edge Function + opt-in + moderasi + anti-cheat).
  **GERBANG privasi §3 wajib lewat.**

## 7. Status

- LB-1 (engine + papan pribadi) = **buildable & verifiable sekarang** (deterministik, lokal).
- LB-3 (sosial) = **tunggu gerbang privasi + backend** — keputusan/sumber daya Firman.

Referensi: `docs/addendum-cek-klaim.md` & `docs/addendum-katalog.md` (pola fitur berisiko + gerbang),
Gamification Fase 6 (`packages/core/gamification.ts`), CONTEXT §4.
