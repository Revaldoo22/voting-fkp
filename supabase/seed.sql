-- =====================================================================
-- Festival Karakter Pelajar Universitas STEKOM — Seed data
--
-- Contains ONLY reference data (no dummy participants/voters/votes).
-- Run AFTER migrations 0001..0003 (Supabase SQL Editor or CLI).
--
-- NOTE: The admin account is NOT created here. Creating auth users via raw
-- INSERT into auth.users is fragile (GoTrue can 500 on missing columns).
-- Create the admin via the Admin API instead:
--     npm run seed:admin
-- (see scripts/seed-admin.mjs). Default: 081200000000 / admin123.
-- =====================================================================

-- ---- Schools --------------------------------------------------------
-- Sekolah TIDAK di-seed. Daftar sekolah tumbuh otomatis dari input data
-- peserta (admin mengetik/memilih sekolah saat membuat peserta). Voter hanya
-- bisa memilih sekolah yang sudah memiliki peserta.

-- ---- Quests (starter quests) ----------------------------------------
-- proof_type 'file' = upload screenshot; 'link' = kirim URL postingan.
-- Ganti URL akun di deskripsi sesuai akun resmi panitia.
insert into public.quests (name, description, point, status, proof_type) values
  ('Follow TikTok STEKOM',   'Follow TikTok @stekom lalu upload screenshot bukti follow.',        10, 'active', 'file'),
  ('Follow Instagram STEKOM','Follow Instagram @stekom lalu upload screenshot bukti follow.',     10, 'active', 'file'),
  ('Follow TikTok Toploker', 'Follow TikTok @toploker lalu upload screenshot bukti follow.',      10, 'active', 'file'),
  ('Follow Instagram Toploker','Follow Instagram @toploker lalu upload screenshot bukti follow.', 10, 'active', 'file'),
  ('Bikin Video Dukungan',   'Buat video dukungan, posting di sosial media, lalu kirim link postingannya.', 50, 'active', 'link'),
  ('Bikin Poster Dukungan',  'Buat poster ajakan dukungan, posting di sosial media, lalu kirim link postingannya.', 30, 'active', 'link')
on conflict do nothing;
