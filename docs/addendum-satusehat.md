# Addendum — SATUSEHAT / Interoperabilitas FHIR (Backlog V3)

Status: **desain + fondasi FHIR (SS-1) — API SATUSEHAT tersandera registrasi organisasi.**
Indeks: `docs/roadmap-v3.md §7` (backlog). Prinsip CONTEXT §4 (keselamatan, deterministik-first,
non-diagnosis, data kesehatan T1) berlaku penuh.

## 1. Ringkasan

SATUSEHAT (dulu IHS — Indonesia Health Services) adalah **platform interoperabilitas data
kesehatan nasional Kemenkes** berbasis **HL7 FHIR R4**. Faskes/aplikasi bertukar data lewat
resource FHIR (Patient, Observation, Encounter, MedicationRequest, Immunization, dst).

Untuk ArtaHealth (companion pribadi, bukan faskes), nilai SATUSEHAT ada dua arah:
- **Ekspor / push** — kirim data yang dicatat pengguna ke ekosistem faskes.
- **Impor / pull** — tarik rekam medis resmi pengguna (lab, kunjungan, imunisasi) ke ArtaHealth.

**Keduanya butuh registrasi organisasi.** Yang TIDAK butuh registrasi, dan bernilai sekarang,
adalah **pemetaan data ArtaHealth ↔ FHIR R4** yang benar secara standar. Itulah SS-1.

## 2. Gerbang regulasi (kenapa API ditunda)

Akses SANDBOX/STAGING/PRODUCTION SATUSEHAT diberikan ke **organisasi terdaftar** (Client Key,
Client Secret, `Organization ID`), lewat proses onboarding Kemenkes (SPBE/Platform SATUSEHAT).
Aplikasi companion pribadi **tidak** bisa memperoleh kredensial produksi tanpa menjadi/menggandeng
organisasi terdaftar + memenuhi kebijakan data kesehatan, consent pasien (No. IHS/`IHS Number`),
dan audit keamanan. Ini gerbang setara "device + akun developer" pada Wearable — **keputusan &
sumber daya di sisi Firman/organisasi.**

Konsekuensi arsitektur: kode yang menyentuh jaringan SATUSEHAT (OAuth token, POST Bundle,
GET resource) **inert** sampai kredensial ada; fondasi pemetaan FHIR berdiri sendiri & teruji.

## 3. Arsitektur (deterministik-first)

```
Data ArtaHealth (Dexie: biomarker, obat, imunisasi, profil)
  → packages/core/fhir.ts  (pemetaan MURNI & TERUJI ke FHIR R4: LOINC/UCUM)
  → Bundle FHIR (type: collection)
  → [SS-1] ekspor berkas .json (dibawa ke faskes / diarsipkan) — TANPA jaringan
  → [SS-2] Edge Function satusehat-sync: OAuth2 client-credentials → POST /Bundle
           (di balik kredensial organisasi; inert tanpa secret)
```

- **Engine `fhir.ts`** murni (tanpa I/O) → bisa diuji unit + dipakai ekspor & (kelak) push.
- **Sumber kode**: LOINC untuk observasi lab/vital; UCUM untuk satuan; teks Indonesia sebagai
  `.text` pendamping. Resource yang belum punya padanan kode kuat (imunisasi → CVX/SATUSEHAT
  concept map) ditandai jujur & ditunda sampai peta kode diverifikasi.

## 4. Pemetaan FHIR (SS-1)

| Data ArtaHealth | Resource FHIR | Kode |
|---|---|---|
| Profil (nama, sex, tgl lahir) | `Patient` | — |
| Tekanan darah | `Observation` (vital-signs) | LOINC 85354-9 panel; komponen 8480-6 / 8462-4; UCUM `mm[Hg]` |
| Glukosa (gdp/gds/pp2/hba1c) | `Observation` (laboratory) | LOINC 1558-6 / 2339-0 / 1521-4 / 4548-4; `mg/dL` atau `%` |
| Lipid (total/LDL/HDL/TG) | `Observation` ×N (laboratory) | LOINC 2093-3 / 2089-1 / 2085-9 / 2571-8; `mg/dL` |
| Asam urat | `Observation` (laboratory) | LOINC 3084-1; `mg/dL` |
| Obat | `MedicationStatement` | `medicationCodeableConcept.text` (nama bebas) + `dosage.text` |
| Imunisasi | `Immunization` | **DITUNDA** — butuh concept map ke CVX/SATUSEHAT + verifikasi |

`Bundle` `type: collection`, tiap entri satu resource. Non-diagnosis: observasi = nilai + satuan +
waktu apa adanya (tanpa `interpretation` klinis dari kami).

## 5. Privasi & keamanan (T1)

- Data kesehatan T1: ekspor **atas aksi eksplisit pengguna**, berkas dibuat **di perangkat**
  (client-side Blob), tak ada unggah otomatis. TIDAK pernah ke log/analytics/Sentry.
- Push SATUSEHAT (SS-2) hanya dengan consent pasien + kredensial organisasi + audit.
- Tak menyimpan kredensial di klien; token OAuth di Edge Function (server), bukan bundel web.

## 6. Increment

- **SS-1 (SEKARANG)**: `fhir.ts` pemetaan Patient + Observation (biomarker) + MedicationStatement,
  `buildFhirBundle`, teruji. `lib/satusehat.ts` rakit Bundle dari Dexie + ekspor `.json`. Kartu di
  balik flag `NEXT_PUBLIC_FEATURE_SATUSEHAT`: pratinjau + Unduh berkas FHIR. **Tanpa jaringan.**
- **SS-2**: Edge Function `satusehat-sync` (OAuth2 client-credentials + POST `/Bundle`), di balik
  secret `SATUSEHAT_CLIENT_ID/SECRET/ORG_ID`; inert tanpa secret. Butuh registrasi organisasi.
- **SS-3**: impor/pull (GET resource pasien via IHS Number) → petakan balik ke Dexie.
- **SS-4**: Immunization concept map (CVX/SATUSEHAT) + Encounter/Condition bila relevan.

## 7. GERBANG sebelum flag/rilis "live sync"

1. **Registrasi organisasi SATUSEHAT** + kredensial produksi (Kemenkes onboarding).
2. **Consent pasien** + alur IHS Number; kebijakan data kesehatan & retensi.
3. **Verifikasi peta kode** (LOINC/UCUM untuk lab; CVX/SATUSEHAT untuk imunisasi) oleh nakes.
4. **Audit keamanan** token/enkripsi/scope; uji sandbox → staging → produksi.
5. **Keputusan produk**: arah utama (ekspor vs impor) & cakupan resource.

Ekspor berkas FHIR (SS-1) **tidak** menunggu gerbang ini — offline, tanpa kredensial, milik
pengguna. Yang menunggu gerbang hanyalah sinkronisasi jaringan (SS-2+).

## 8. Risiko & keputusan terbuka

- **Registrasi organisasi** = penghambat utama sinkronisasi (di luar kendali kode).
- **Peta kode imunisasi** (CVX vs SATUSEHAT) butuh verifikasi → ditunda dari SS-1.
- **Arah utama** (push vs pull) belum diputuskan — fondasi FHIR agnostik arah; UI spesifik
  menyusul setelah keputusan Firman.

## 9. Status

- SS-1 fondasi FHIR = **buildable & verifiable sekarang** (deterministik, offline).
- SS-2+ (jaringan SATUSEHAT) = **tersandera registrasi organisasi** — keputusan/sumber daya Firman.

Referensi: `docs/addendum-wearable.md` (pola fondasi-dulu, native/gated menyusul),
`docs/roadmap-v3.md §7` (backlog), CONTEXT §4 (keselamatan & privasi T1).
