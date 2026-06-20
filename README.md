# Festival Karakter Pelajar — Universitas STEKOM

Platform kompetisi pelajar SMA/SMK. Pengunjung (voter) mendukung peserta lewat **vote harian** dan **quest**. Pemenang dapat smartphone, sertifikat, dan status **Duta Teladan Universitas STEKOM**.

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **React Hook Form** + **Zod** + **TanStack Query** + **Recharts**
- **Supabase** — Database, Auth, Storage, Realtime, Row Level Security
- **FingerprintJS** — device fingerprint (anti-cheat)
- Deploy: **Vercel**

---

## Peran & Akses

| Peran | Akses | Login |
|------|-------|-------|
| **Voter** (pendukung) | Publik, **tanpa akun**. Buka home → pilih peserta → isi data (nama, WhatsApp, email, status, sekolah/kelas opsional) → vote / kerjakan quest | — |
| **Peserta** | Dashboard sendiri: poin, ranking, grafik, supporter, kelola konten, ganti foto/deskripsi/password | Nama **atau** Nomor WhatsApp + password (`/login/peserta`) |
| **Admin** | Kelola peserta, sekolah, quest, verifikasi submission, buka/tutup event | Nama **atau** Nomor WhatsApp + password (`/login/admin`) |

Admin & peserta auth lewat Supabase Auth dengan email sintetis `<nomor>@stekom.local` (lihat `src/lib/auth.ts`). Voter anonim — tidak punya akun; identitasnya ikut tiap submission (disimpan, diingat di localStorage).

---

## Anti-Cheat

Vote harian **+5 poin**, ditegakkan di DB + RPC `cast_vote` (dijalankan server pakai service role):

- **1 dukungan / peserta / hari** per **device**, **nomor WhatsApp**, dan **email**. Voter boleh dukung beberapa peserta (masing-masing 1×/hari).
- **Tidak bisa vote diri sendiri** (cocokkan nomor WA peserta).
- **1 nomor WhatsApp = 1 identitas** (nama/status konsisten).
- **IP soft-limit**: batasi jumlah akun dari satu jaringan/hari (IP hanya disimpan sebagai hash bersalt, bukan IP mentah).
- **Link konten unik global** untuk quest jenis link (1 link = 1×).
- Quest poin masuk **setelah disetujui admin**.

Fingerprint = FingerprintJS + hash header server (`src/lib/server-hash.ts`).

---

## Setup Lokal

### 1. Buat project Supabase
[database.new](https://database.new) → catat **Project URL**, **anon key**, **service_role key** (Settings → API).

### 2. Jalankan migrations + seed
Lewat Supabase **SQL Editor**, jalankan berurutan semua file di `supabase/migrations/` (`0001` … `0014`), lalu `supabase/seed.sql`.

Atau Supabase CLI:
```bash
supabase db push
supabase db execute -f supabase/seed.sql
```
> Sekolah tidak di-seed — tumbuh otomatis dari input peserta.

### 3. Environment
```bash
cp .env.example .env.local
```
Isi sesuai `.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only, rahasia
NEXT_PUBLIC_SITE_URL=http://localhost:3000
IP_HASH_SALT=...                     # string acak panjang, server-only
```

### 4. Buat akun admin
Admin dibuat via Admin API (bukan SQL):
```bash
npm run seed:admin                          # pakai kredensial default di scripts/seed-admin.mjs
npm run seed:admin <nomor> <password> <nama>  # custom
```
Script ini **mengganti** admin lama (hanya ada satu admin aktif). Kredensial default ada di `scripts/seed-admin.mjs` — **ganti untuk produksi**.

### 5. Jalankan
```bash
npm install
npm run dev
```
Buka http://localhost:3000. Login admin di `/login/admin`.

### (Opsional) Data dummy
```bash
npm run seed:dummy      # sekolah, peserta (foto Unsplash → Storage), voter contoh
```
Jangan jalankan di produksi.

---

## Alur Singkat

1. **Admin** tambah peserta (`/admin/participants`) → sistem buat password peserta (tampil sekali, salin & bagikan). Atur quest (`/admin/quests`) & buka event (`/admin`).
2. **Peserta** login → kelola **konten** (link untuk quest like/komen/repost & sound), deskripsi, foto.
3. **Voter** (publik) buka home → klik peserta → vote (+5) / kerjakan quest dengan isi data diri.
4. **Admin** verifikasi quest (`/admin/submissions`) → Approve → poin masuk otomatis.
5. Publik lihat `/ranking` (realtime) & `/top-voter`.

## Routes

```
/                       Home — daftar semua peserta (publik)
/peserta/[id]           Detail peserta: vote + quest
/login                  Pilih Admin / Peserta
/login/admin            Login admin
/login/peserta          Login peserta
/participant/dashboard  Dashboard peserta
/admin                  Dashboard + toggle event
/admin/participants     CRUD peserta + atur/reset password
/admin/submissions      Verifikasi quest (approve/reject + alasan)
/admin/quests           CRUD quest
/admin/schools          CRUD sekolah
/ranking                Leaderboard peserta (realtime)
/top-voter              Top voter (by nomor WhatsApp)
```

## Deploy ke Vercel

1. Import repo di Vercel (akun GitHub yang punya akses repo).
2. Set env vars (5 di atas) di **Settings → Environment Variables**.
3. Deploy. Tiap push ke `main` → auto-deploy.
4. Setelah live: jalankan `npm run seed:admin` dengan env Supabase produksi untuk membuat admin; update `NEXT_PUBLIC_SITE_URL` ke domain final.

> `.env.local` tidak ikut Git — env diisi manual di Vercel.

## Struktur

```
src/
  app/          pages + api routes (/api/vote, /api/submissions, /api/auth/*, /api/admin/*, /api/participant/*)
  components/   ui (shadcn), navbar, participant-grid, voter-form-fields, charts, dst
  lib/          supabase clients, fingerprint, server-hash, rate-limit, validations, queries, auth
  types/        database types
supabase/
  migrations/   0001 … 0014 (jalankan berurutan)
  seed.sql      quest starter
scripts/        seed-admin.mjs, seed-dummy.mjs
middleware.ts   proteksi route admin & peserta
```

## Keamanan

- RLS aktif di semua tabel. Peserta hanya akses datanya; admin penuh; peserta & data vote publik untuk leaderboard.
- Vote/submission lewat RPC `SECURITY DEFINER` via **service role** di route handler (anti-cheat & aturan di DB).
- `SUPABASE_SERVICE_ROLE_KEY` & `IP_HASH_SALT` **server-only** — jangan expose ke browser.
- Ganti kredensial admin default sebelum produksi.
```
