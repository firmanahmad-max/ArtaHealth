-- ArtaHealth · Migration 0021 · Sadar Gizi — ambang gizi ditinjau ahli gizi (Fase 4)
-- Gerbang §10-§11 lulus (Agu 2026): ambang traffic-light disetujui APA ADANYA oleh
-- ahli gizi. Nilai tidak berubah — hanya label guideline_ref dari "(kerangka)" →
-- "(ditinjau ahli gizi)", sinkron dengan DEFAULT_NUTRITION_BANDS bundled.
-- (Pola sama Fase 2: migration 0012 memperbarui label rujukan asam urat.)
-- Tabel nutrition_bands masih inert (app pakai DEFAULT_NUTRITION_BANDS) — update ini
-- untuk konsistensi/masa depan.

update nutrition_bands
set guideline_ref = replace(guideline_ref, '(kerangka)', '(ditinjau ahli gizi)')
where guideline_ref like '%(kerangka)%';
