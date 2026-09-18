# Checklist Rilis — Fase 8 (Konsolidasi & Retensi)

Owner: Firman. Semua KR (1–5) + konsolidasi **SELESAI DI KODE & MERGE ke main**. Tak ada
migrasi / Edge Function / secret baru — semuanya **deterministik, reuse data**. Rilis = **redeploy**
(untuk perubahan tanpa-flag) + **nyalakan 3 flag baru**. Flag build-time → tiap ubah flag **wajib
redeploy Vercel**.

> Konteks: Fase 8 merapikan yang sudah dibangun (bukan fitur baru berisiko). Prinsip CONTEXT §4
> tetap: non-medis, deterministik, regresi nol saat flag mati.

## 1. Ringkasan

| Item | Jenis | Flag | Aksi rilis |
|---|---|---|---|
| **Fokus Hari Ini** (KR-1) + pelengkap Insight | fitur, flag | `NEXT_PUBLIC_FEATURE_FOCUS` | nyalakan `=1` + redeploy |
| **"Apa Baru"** (KR-4) | fitur, flag | `NEXT_PUBLIC_FEATURE_WHATSNEW` | nyalakan `=1` + redeploy |
| **Ringkasan Mingguan** (KR-5) | fitur, flag | `NEXT_PUBLIC_FEATURE_WEEKLY_RECAP` | nyalakan `=1` + redeploy |
| **Empty-state memandu** (KR-2) | perbaikan | — (pakai flag WHATIF/MONTHLY yg ada) | **redeploy saja** |
| **Organisasi Beranda** (KR-3: bagian + lipat) | perbaikan | — | **redeploy saja** |
| **Katalog → Lemari** (konsolidasi #1) | perbaikan | `CATALOG` jadi **dorman** | **redeploy saja** + boleh matikan CATALOG |
| **Papan Poin → Petualangan Sehat** (#2a) | perbaikan | `LEADERBOARD` kini butuh `GAMIFICATION` | **redeploy saja** |
| **Fokus ⟷ Insight anti-dobel** (PR #63) | perbaikan | — | **redeploy saja** |

> ⚠️ Perubahan tanpa-flag (KR-2/KR-3 + semua konsolidasi) sudah di `main` tapi **belum live** —
> ter-merge SETELAH redeploy terakhirmu. **Satu redeploy** membuat semuanya aktif sekaligus.

## 2. Langkah rilis (urut)

1. **Redeploy Production** dari `main` terkini → menyalakan seluruh perubahan tanpa-flag
   (KR-2, KR-3, konsolidasi #1/#2a, fix Fokus/Insight).
2. **Nyalakan 3 flag baru** di Vercel → Settings → Environment Variables (Production), value `1`:
   - [ ] `NEXT_PUBLIC_FEATURE_FOCUS` (bila belum)
   - [ ] `NEXT_PUBLIC_FEATURE_WHATSNEW`
   - [ ] `NEXT_PUBLIC_FEATURE_WEEKLY_RECAP`
3. **Redeploy lagi** (flag build-time butuh redeploy agar terbaca).
4. (Opsional) **Matikan `NEXT_PUBLIC_FEATURE_CATALOG`** — kini dorman (kartu Katalog dilebur ke
   Lemari; flag dicadangkan untuk KC-2 komunal).

```bash
# contoh (jalankan sendiri; Claude tak bisa akses Vercel-mu):
vercel env add NEXT_PUBLIC_FEATURE_WEEKLY_RECAP production   # isi: 1
```

## 3. Prasyarat backend

**TIDAK ADA.** Fase 8 tak butuh migrasi, Edge Function, atau secret. Semua membaca data yang sudah
ada di Dexie/Supabase. (Migrasi 0026 wearable sudah di-push sebelumnya; tak relevan untuk Fase 8.)

## 4. Smoke test prod (setelah redeploy + flag)

- [ ] **Beranda terkelompok**: muncul bagian **"Kesehatan · N"** & **"Alat & Data · N"**; "Alat &
      Data" default **terlipat** → klik "tampilkan" → kartunya muncul; status lipat bertahan saat reload.
- [ ] **Fokus Hari Ini** muncul di atas saat belum ada catatan hari ini; setelah catat 1 log →
      digantikan **Insight hari ini** (tak dobel).
- [ ] **"Apa Baru"** muncul (entri sesuai flag yang menyala) → **"Mengerti"** → hilang & tak balik
      setelah reload.
- [ ] **Ringkasan Mingguan** ("📅 Minggu Ini") muncul bila ada aktivitas minggu ini (hari aktif/
      catatan/streak + kalimat motivasi).
- [ ] **Lemari produk** (Sadar Gizi): tombol "🗄️ Lemari (N)" → saat >4 produk, muncul **kotak cari**;
      kartu "Katalog Produk" standalone **tidak ada** lagi.
- [ ] **Papan poin mingguan** kini section **di dalam** "🎮 Petualangan Sehat"; kartu "Papan Poin
      Pribadi" standalone **tidak ada**.
- [ ] **What-If** saat belum ada catatan → empty-state + tombol **"Catat hari ini"** (buka log sheet),
      bukan proyeksi dari default.
- [ ] Tanpa error konsol.

## 5. Rollback

- **Fitur ber-flag** (Fokus/Apa Baru/Ringkasan Mingguan): set flag `=0` + redeploy → hilang, regresi nol.
- **Perubahan tanpa-flag** (KR-2/KR-3/konsolidasi): tak bisa di-flag-off. Bila perlu dibatalkan,
  `git revert` PR terkait (#63 Fokus/Insight, #64 Katalog→Lemari, #65 Papan Poin→Gamification,
  #66 KR-3 sections, #67 KR-2) lalu redeploy. Risikonya rendah (murni presentasi/pengelompokan).

## 6. Follow-up (tersandera backend = Firman)

- **Push mingguan otomatis** — reuse engine `@arta/core weeklyRecap` untuk isi notifikasi via cron
  (`send-reminders`) + kebijakan anti-spam. Bagian in-app (Ringkasan Mingguan) sudah siap jadi
  tujuan tautannya.

Referensi: `docs/roadmap-fase8.md`, `docs/release-checklist-v3.md`,
`docs/release-checklist-backlog.md` (track V3 ter-blocked WR-2/SS-2/KC-2/LB-3).
