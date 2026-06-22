# Migrasi ke Supabase Baru (pg_dump full)

Pindahkan database lama → project Supabase baru, **termasuk akun** (auth.users)
dan semua data. Foto Storage dipindah terpisah (lihat bagian akhir).

> Estimasi downtime: 15–30 menit. Lakukan saat trafik sepi + nyalakan overlay
> maintenance (`NEXT_PUBLIC_MAINTENANCE=true` di Vercel → redeploy).

---

## 0. Prasyarat (siapkan dulu)

- **PostgreSQL client** terinstal (`pg_dump`, `psql`) — versi 15+.
  - Windows: https://www.postgresql.org/download/windows/ (saat install centang "Command Line Tools").
  - Cek: `pg_dump --version`
- **Connection string** kedua project (Supabase Dashboard → Project Settings →
  Database → Connection string → **URI**, mode **Session**). Bentuk:
  `postgresql://postgres.<ref>:<password>@<host>:5432/postgres`
- Backup terbaru sudah ada (`npm run backup` + `npm run backup:storage`).

---

## 1. Buat project Supabase baru

1. https://database.new → buat project (region sama: **Southeast Asia / Singapore**).
2. Catat: **Project URL**, **anon key**, **service_role key**, **DB password**.
3. (Belum perlu jalankan migration — pg_dump bawa skema lengkap.)

---

## 2. Nyalakan maintenance (Vercel)

- Vercel → Settings → Environment Variables → `NEXT_PUBLIC_MAINTENANCE=true` → **Redeploy**.
- Pastikan overlay tampil di home (voter berhenti menulis data).

---

## 3. Dump database lama

Ganti `<OLD_URI>` dengan connection string project LAMA.

```bash
pg_dump "<OLD_URI>" \
  --clean --if-exists --quote-all-identifiers \
  --no-owner --no-privileges \
  -n public -n auth -n storage \
  -f dump-full.sql
```

- `-n public` = data app, `-n auth` = akun (admin/peserta), `-n storage` = metadata file.
- Kalau `--clean` bermasalah di project baru yang sudah ada skema, lihat alternatif di bawah.

> **Tips:** kalau hanya mau data app + akun (tanpa metadata storage), cukup `-n public -n auth`.

---

## 4. Restore ke project baru

Ganti `<NEW_URI>` dengan connection string project BARU.

```bash
psql "<NEW_URI>" -f dump-full.sql
```

- Abaikan warning "role does not exist" / "already exists" — wajar lintas project.
- Kalau ada error extension, jalankan dulu di SQL Editor project baru:
  `create extension if not exists pgcrypto;`

---

## 5. Pindahkan foto Storage

Metadata storage ikut di dump, tapi **file fisik tidak**. Dua opsi:

**A. Re-upload dari backup lokal** (paling aman):
- Pastikan `backups/storage/` hasil `npm run backup:storage` lengkap.
- Set `.env.local` ke project BARU, lalu jalankan:
  ```bash
  npm run restore:storage
  ```
  (script meng-upload ulang semua file ke bucket yang sama.)

**B. Biarkan URL lama** — kalau project lama belum dihapus, foto tetap ter-serve
dari URL lama. Tidak disarankan jangka panjang.

---

## 6. Update environment

- **`.env.local`** (lokal) → URL/anon/service-role project BARU.
- **Vercel** → Environment Variables → ganti `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ke project baru.

---

## 7. Verifikasi

- `npm run dev` → buka home, cek peserta + foto muncul.
- Login admin & peserta (akun ikut dari auth dump).
- Cek `/admin` stats, `/admin/voters`, vote uji 1x.
- Pastikan **Anonymous sign-in TIDAK diperlukan** (voter anonim pakai service role) ✓.

---

## 8. Matikan maintenance

- Vercel → `NEXT_PUBLIC_MAINTENANCE=false` → **Redeploy**.
- Event jalan lagi di project baru.

---

## Rollback

Kalau gagal: balikkan env Vercel ke project LAMA + matikan maintenance.
Project lama tetap utuh (pg_dump tidak mengubahnya).
