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
-- NOTE: jika sudah menjalankan migration 0010, daftar quest sudah terisi.
-- Block ini untuk setup baru yang menjalankan seed.sql langsung.
-- proof_type 'file' = upload screenshot; 'link' = kirim URL postingan.
insert into public.quests (name, description, point, status, proof_type, frequency) values
  ('Follow Instagram STEKOM', 'Follow akun Instagram resmi STEKOM, lalu upload screenshot bukti follow.', 10, 'active', 'file', 'global'),
  ('Follow TikTok STEKOM', 'Follow akun TikTok resmi STEKOM, lalu upload screenshot bukti follow.', 10, 'active', 'file', 'global'),
  ('Follow Instagram Toploker', 'Follow akun Instagram Toploker, lalu upload screenshot bukti follow.', 10, 'active', 'file', 'global'),
  ('Follow TikTok Toploker', 'Follow akun TikTok Toploker, lalu upload screenshot bukti follow.', 10, 'active', 'file', 'global'),
  ('Bikin Konten Dukungan', 'Buat konten (video/reel) dukungan untuk peserta, posting, lalu kirim link postingannya.', 50, 'active', 'link', 'once'),
  ('Like, Komen, Repost Video Peserta', 'Like, komentari, dan repost video peserta, lalu upload screenshot buktinya.', 20, 'active', 'file', 'once'),
  ('Konten Pakai Sound Video Peserta', 'Buat konten TikTok memakai sound yang ada di video peserta, lalu kirim link kontenmu.', 50, 'active', 'link', 'once')
on conflict do nothing;
