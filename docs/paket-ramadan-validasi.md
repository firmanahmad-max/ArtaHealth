# Paket Ramadan — Validasi Minat (Fase 9 · RW-4a)

> Tujuan: buktikan **ada yang mau bayar** sebelum mengurus legal & payment gateway (master-roadmap §5).
> RW-4a = waitlist **tanpa pembayaran**. Tidak ada data kartu, tidak ada transaksi.

## 1. Apa yang dibangun

| Lapisan | Berkas | Isi |
|---|---|---|
| Engine | `packages/core/src/paket-ramadan.ts` | `PAKET_TIERS` (harga), `PAKET_BENEFITS`, `PAKET_FREE_CORE`, `formatRupiah`, `paketInterestSummary` (6 test) |
| Data | `supabase/migrations/0028_paket_interest.sql` | Tabel `paket_interest` — 1 baris/profil: `choice` + waktu. RLS milik sendiri |
| Lib | `apps/web/lib/paket-interest.ts` | Simpan pilihan di `meta` lokal → upsert ke Supabase; gagal/offline → dicoba lagi saat kartu dibuka |
| UI | `apps/web/components/PaketRamadanInterestCard.tsx` | Manfaat + 3 opsi harga + "Belum perlu"; setelah memilih → menyusut jadi 1 baris + "Ubah" |
| Flag | `NEXT_PUBLIC_FEATURE_PAKET_INTEREST` | OFF default. Kartu di Beranda setelah "Apa Baru" |

### Opsi yang ditawarkan (ubah di `PAKET_TIERS` sebelum dinyalakan)

| ID | Nama | Harga | Periode |
|---|---|---|---|
| `season` | Paket Ramadan | Rp29.000 | sekali bayar · 30 hari |
| `season_syawal` | Ramadan + Syawal | Rp39.000 | sekali bayar · ±45 hari |
| `pro_annual` | PRO Tahunan | Rp149.000 | per tahun |
| `not_now` | Belum perlu | — | — |

**Status manfaat:** #1 Wrapped kartu gambar **SUDAH DIBANGUN** (`core/fasting/wrapped-share.ts` + `lib/wrapped-image.ts`, flag `NEXT_PUBLIC_FEATURE_WRAPPED_SHARE` OFF; privasi-dulu: qadha tak pernah ikut, % opsional, gambar dibuat di perangkat). #2 Laporan Puasa (PDF) **SUDAH DIBANGUN** (`core/fasting/fasting-report.ts` + `lib/fasting-report.ts` + `FastingReportCard`, flag `NEXT_PUBLIC_FEATURE_FASTING_REPORT` OFF: gula & tensi saat jam puasa vs di luar, hitungan ambang `RED_FLAG_THRESHOLDS`, obat di jam puasa, kepatuhan, berat; cetak/PDF via browser). #3–#4 belum.

**Tetap gratis (dijanjikan di kartu):** imsakiyah, pengingat sahur & berbuka, panduan medis puasa, cek konflik obat.
Fitur keselamatan tak pernah dikunci di balik pembayaran.

## 2. Langkah menyalakan (Firman)

1. Tinjau harga/manfaat di `PAKET_TIERS` / `PAKET_BENEFITS` — jangan janjikan fitur yang belum ada jadwalnya.
2. `npx supabase db push` (migration **0028** — WAJIB sebelum flag, kalau tidak upsert gagal diam-diam dan hanya tersimpan lokal).
3. Vercel → set `NEXT_PUBLIC_FEATURE_PAKET_INTEREST=1` → redeploy.
4. Smoke-test: login → kartu muncul di Beranda → pilih satu opsi → cek baris di Supabase (langkah 3 di bawah).
5. Biarkan berjalan **2–4 minggu** (idealnya mulai Desember 2026, jauh sebelum Ramadan ~Feb 2027).

## 3. Membaca hasil

```sql
-- Distribusi pilihan
select choice, count(*) from paket_interest group by choice order by 2 desc;

-- Pengguna aktif 30 hari (penyebut tingkat minat)
select count(distinct profile_id) from daily_scores where date >= current_date - 30;
```

Masukkan ke `paketInterestSummary(counts, activeUsers, thresholdPct = 10)`:
`interestRatePct = (season + season_syawal + pro_annual) / activeUsers × 100`.

| Hasil | Keputusan |
|---|---|
| ≥ 10% pengguna aktif berminat | **Lanjut RW-4b** (legal + payment sandbox). `topTier` = paket yang diprioritaskan |
| 5–10% | Uji ulang harga/manfaat (mis. turunkan harga atau ganti manfaat), jalankan 2 minggu lagi |
| < 5% atau mayoritas `not_now` | Tunda monetisasi; Ramadan 2027 rilis gratis penuh, fokus retensi |

> Catatan: jumlah respons kecil (< 50) → anggap sinyal arah, bukan angka pasti.

## 4. Setelah lolos gerbang — RW-4b s/d RW-4d (ringkas)

- **B · Legal:** daftar PSE Lingkup Privat (Komdigi, via OSS), kebijakan privasi sesuai UU PDP, Syarat Layanan + kebijakan refund, NPWP untuk merchant.
- **B · Payment sandbox:** akun Midtrans/Xendit → kunci **sandbox** disimpan sebagai secret Supabase (`npx supabase secrets set PAYMENT_SERVER_KEY=...`) — **jangan pernah ditempel di chat/kode**. Pakai *hosted checkout* (tak menyentuh data kartu).
- **C · Integrasi:** Edge Function buat transaksi + webhook verifikasi signature → tulis ke tabel `subscriptions` yang **sudah ada** (migration 0003: `tier free|pro`, `valid_until`, `provider midtrans|manual|playstore` — perlu ditambah nilai tier musiman, mis. `ramadan`) → gating fitur premium.
- **D · Go-live:** ganti ke kunci produksi ±H-14 Ramadan, uji transaksi nyata nominal kecil, siapkan alur refund.

## 5. Privasi

Tabel hanya menyimpan `profile_id` + pilihan + waktu. Tanpa data kesehatan, tanpa data pembayaran.
Profil dihapus → baris ikut terhapus (`on delete cascade`).
