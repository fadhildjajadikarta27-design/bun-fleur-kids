ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS background_id text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD CONSTRAINT orders_background_id_check CHECK (background_id IN ('','01_Langit_Cerah','02_Taman','03_Pelangi','04_Awan_Lucu','05_Luar_Angkasa','06_Laut','07_Gunung','08_Ulang_Tahun','09_Sekolah'));
