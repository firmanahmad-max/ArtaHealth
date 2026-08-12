-- ArtaHealth · Migration 0012 · Perbaikan atribusi sumber asam urat (V2)
-- Ambang V2 sudah direview dokter (12 Agu 2026). Label sementara
-- "Rujukan lab (perlu review)" diganti "Nilai rujukan laboratorium" — jujur:
-- M<7.0 / W<6.0 mg/dL adalah rentang rujukan lab standar, bukan cutoff satu
-- guideline bernama. Menjaga biomarker_bands sinkron dgn DEFAULT_BIOMARKER_BANDS.
-- Murni data (UPDATE), tanpa perubahan skema.

update biomarker_bands
   set guideline_ref = 'Nilai rujukan laboratorium'
 where biomarker = 'uric_acid'
   and guideline_ref = 'Rujukan lab (perlu review)';
