-- ArtaHealth · Migration 0011 · Biomarker V2 (lipid & asam urat)
-- Menambah SEED ambang lipid (NCEP ATP III) & asam urat (sadar-gender) ke tabel
-- biomarker_bands yang sudah ada (0010). Tak ada tabel/kolom baru — murni data.
--
-- ⚠️ AMBANG INI (V2) BUTUH REVIEW DOKTER TERSENDIRI sebelum dibuka ke pengguna.
--    Review V1.5 (BP+glukosa) TIDAK mencakup lipid/asam urat.
--
-- Catatan HDL: TERBALIK — makin tinggi makin baik. rank tetap = keparahan
-- (HDL rendah = rank tinggi), sehingga "kategori terburuk = rank tertinggi"
-- berlaku seragam untuk seluruh parameter panel lipid.

-- A) Profil lipid — NCEP ATP III (mg/dL)
insert into biomarker_bands (biomarker, parameter, band_key, label, zone, min_value, max_value, rank, unit, guideline_ref) values
  ('lipid','total_chol','desirable',  'Diinginkan',      'green',  null, 200, 0, 'mg/dL','NCEP ATP III'),
  ('lipid','total_chol','borderline', 'Batas Tinggi',    'yellow', 200,  240, 1, 'mg/dL','NCEP ATP III'),
  ('lipid','total_chol','high',       'Tinggi',          'red',    240,  null, 2, 'mg/dL','NCEP ATP III'),

  ('lipid','ldl','optimal',      'Optimal',           'green',  null, 100, 0, 'mg/dL','NCEP ATP III'),
  ('lipid','ldl','near_optimal', 'Mendekati Optimal', 'green',  100,  130, 1, 'mg/dL','NCEP ATP III'),
  ('lipid','ldl','borderline',   'Batas Tinggi',      'yellow', 130,  160, 2, 'mg/dL','NCEP ATP III'),
  ('lipid','ldl','high',         'Tinggi',            'orange', 160,  190, 3, 'mg/dL','NCEP ATP III'),
  ('lipid','ldl','very_high',    'Sangat Tinggi',     'red',    190,  null, 4, 'mg/dL','NCEP ATP III'),

  -- HDL terbalik: rendah = buruk (rank tinggi), tinggi = baik (rank 0)
  ('lipid','hdl','low',        'Rendah', 'red',    null, 40, 2, 'mg/dL','NCEP ATP III'),
  ('lipid','hdl','borderline', 'Batas',  'yellow', 40,   60, 1, 'mg/dL','NCEP ATP III'),
  ('lipid','hdl','optimal',    'Baik',   'green',  60,   null, 0, 'mg/dL','NCEP ATP III'),

  ('lipid','tg','normal',     'Normal',        'green',  null, 150, 0, 'mg/dL','NCEP ATP III'),
  ('lipid','tg','borderline', 'Batas Tinggi',  'yellow', 150,  200, 1, 'mg/dL','NCEP ATP III'),
  ('lipid','tg','high',       'Tinggi',        'orange', 200,  500, 2, 'mg/dL','NCEP ATP III'),
  ('lipid','tg','very_high',  'Sangat Tinggi', 'red',    500,  null, 3, 'mg/dL','NCEP ATP III');

-- B) Asam urat — ambang berbeda per jenis kelamin (mg/dL)
insert into biomarker_bands (biomarker, parameter, sex, band_key, label, zone, min_value, max_value, rank, unit, guideline_ref) values
  ('uric_acid','uric_acid','male',  'normal','Normal','green', null, 7.0, 0, 'mg/dL','Rujukan lab (perlu review)'),
  ('uric_acid','uric_acid','male',  'high',  'Tinggi','red',   7.0,  null, 1, 'mg/dL','Rujukan lab (perlu review)'),
  ('uric_acid','uric_acid','female','normal','Normal','green', null, 6.0, 0, 'mg/dL','Rujukan lab (perlu review)'),
  ('uric_acid','uric_acid','female','high',  'Tinggi','red',   6.0,  null, 1, 'mg/dL','Rujukan lab (perlu review)');
