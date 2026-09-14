# Addendum — Katalog Produk Komunal (Backlog V3)

Status: **desain + fondasi lokal/engine (KC-1) — backend komunal (KC-2) tunggu gerbang moderasi.**
Indeks: `docs/roadmap-v3.md §7` (backlog). Prinsip CONTEXT §4 (keselamatan, deterministik-first,
non-diagnosis) berlaku penuh. Melengkapi **Sadar Gizi** (Fase 4) — reuse engine gizi + verdict.

## 1. Ringkasan

Saat ini setiap pengguna memindai label produk kemasan sendiri (OCR → `NutritionInput` → verdict
personal). **Katalog komunal** = kumpulan **fakta gizi per PRODUK** yang dikontribusikan pengguna,
supaya produk yang sudah pernah dipindai orang lain bisa **dicari & dipakai ulang tanpa scan ulang**
— verdict tetap dihitung personal di perangkat (sesuai kondisi masing-masing).

Kunci pembeda dari data lain: **fakta gizi produk BUKAN data pribadi** (mis. "Mi instan X: gula
Ag, natrium Bmg per saji"). Yang TIDAK pernah dibagikan: siapa yang memindai, kapan dikonsumsi,
atau data kesehatan pengguna. Jadi berbagi katalog aman **asalkan** identitas & konsumsi dipisah.

## 2. Privasi & keamanan

- Kontribusi katalog **anonim & tingkat-produk** saja: `{nama, bentuk, gizi per saji, ukuran saji,
  saji per kemasan}`. TANPA profileId/akun/lokasi/waktu-konsumsi. Data kesehatan pengguna = T1,
  **tak pernah** masuk katalog.
- Verdict/personalisasi (kondisi, GGL budget) tetap **di perangkat** — katalog hanya menyuplai
  angka gizi mentah produk.
- Opt-in kontribusi (pengguna memilih menyumbang produk yang ia scan; default tak otomatis kirim).

## 3. Bahaya inti: data gizi salah → verdict orang lain salah

Karena angka katalog dipakai orang lain menilai makanannya, **entri salah/spam bisa menyesatkan**.
Mitigasi DETERMINISTIK (engine, teruji):
- **Konsensus median** — nilai gizi sebuah produk = median lintas kontribusi (bukan entri terakhir)
  → tahan outlier & spam tunggal.
- **Ambang minimum kontribusi** sebelum sebuah entri "tepercaya" ditampilkan tanpa peringatan.
- **Sanity check** angka (reuse `sanityCheck` gizi) menolak kontribusi tak masuk akal.
- **Lapor & moderasi** (KC-2) — flag entri; ambang untuk sembunyikan; audit.
Gerbang konten §6 wajib lewat sebelum tulis-komunal publik.

## 4. Arsitektur (deterministik-first)

```
Kontribusi (NutritionInput per produk, anonim)
  → packages/core/product-catalog.ts  (normalisasi identitas + konsensus median + cari) — MURNI/TERUJI
  → [KC-1] katalog LOKAL dari saved_products milik pengguna (cari & pakai ulang) — TANPA backend
  → [KC-2] tabel bersama product_catalog (baca komunal, tulis termoderasi) — di balik flag+migrasi+gerbang
  → verdict tetap dihitung DI PERANGKAT (nutritionVerdict + kondisi pengguna)
```

- Identitas produk: **kunci ternormalisasi** dari nama (huruf kecil, buang tanda baca/spasi ganda,
  rapikan token ukuran) — barcode = KC-3 (OCR label tak menangkap barcode; butuh input manual/kamera).

## 5. Skema (KC-2, usulan)

**Tabel `product_catalog`** (komunal, baca publik/akun, tulis termoderasi):
| kolom | isi |
|---|---|
| `key` | kunci ternormalisasi (identitas produk) |
| `display_name` | nama tampil representatif |
| `food_form` | `solid` \| `beverage` |
| `nutrition` | JSON `NutritionInput` konsensus (median) |
| `contributions` | jumlah kontribusi |
| `flagged` / `hidden` | status moderasi |
| `updated_at` | standar |

RLS: baca komunal; tulis lewat Edge Function termoderasi (bukan tulis-langsung klien) → cegah spam.
**BUKAN** pola per-profil (data produk publik, bukan milik satu akun).

## 6. Increment & GERBANG

- **KC-1 (SEKARANG)**: `product-catalog.ts` (normalisasi + konsensus + cari) teruji; katalog LOKAL
  dari `saved_products` pengguna (cari/pakai-ulang) di balik flag `NEXT_PUBLIC_FEATURE_CATALOG`.
  **Tanpa backend/migrasi** — fondasi klien yang kelak menyuplai/menerima dari komunal.
- **KC-2**: tabel `product_catalog` + Edge Function kontribusi **termoderasi** (konsensus server +
  sanity + rate-limit) + baca komunal. **Gerbang konten §3** wajib lewat.
- **KC-3**: barcode (input manual/kamera) sebagai identitas kuat + merge lintas-nama.

**GERBANG sebelum tulis-komunal publik**: (1) moderasi/anti-spam operasional; (2) konsensus+sanity
memadai; (3) kebijakan konten & pelaporan; (4) review ahli gizi atas dampak verdict; (5) rate-limit
& audit. Katalog LOKAL (KC-1) tak menunggu gerbang ini.

## 7. Status

- KC-1 (engine + katalog lokal) = **buildable & verifiable sekarang** (deterministik, tanpa backend).
- KC-2 (komunal) = **tunggu gerbang moderasi + backend** — keputusan/sumber daya Firman.

Referensi: `docs/addendum-cek-klaim.md` (pola gerbang konten berisiko), Sadar Gizi Fase 4
(`packages/core/nutrition.ts`), CONTEXT §4.
