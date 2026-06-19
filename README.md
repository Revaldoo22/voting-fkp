# Festival Karakter Pelajar — Universitas STEKOM

Platform kompetisi karakter pelajar SMA/SMK. Setiap siswa jadi peserta individu yang membawa nama sekolahnya dan berlomba mengumpulkan dukungan terbanyak. Pemenang dapat smartphone, sertifikat, dan status **Duta Teladan Universitas STEKOM**.

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **React Hook Form** + **Zod**
- **TanStack Query**
- **Recharts**
- **Supabase** — Database, Auth, Storage, Realtime, Row Level Security
- **FingerprintJS** — device fingerprint anti-cheat
- Deploy: **Vercel-ready**

## Role & Login

| Role | Login | Catatan |
|------|-------|---------|
| **Voter** | Nama + sekolahmu + sekolah peserta yang didukung + status + Nomor WhatsApp + password | 1 WhatsApp = 1 akun, 1 device = 1 akun |
| **Peserta** | Nomor WhatsApp + password | Password **dibuat otomatis** oleh admin saat peserta dibuat (ditampilkan sekali) |
| **Admin** | Nomor WhatsApp + password | Di-seed (`seed.sql`) |

Admin & peserta auth lewat Supabase Auth dengan email sintetis `<nomor>@stekom.local` (lihat `src/lib/auth.ts`).

## Anti-Cheat (Daily Vote +5)

Dua aturan, ditegakkan di DB + RPC `cast_daily_vote`:

- **1 akun = 1 vote/hari** — unique `(user_id, vote_date)`. Pindah device tetap ditolak.
- **1 device = 1 vote/hari** — unique `(device_fingerprint, vote_date)`. Ganti akun tetap ditolak.
- **1 device terikat 1 akun** — unique pada `user_devices.device_fingerprint`.

Fingerprint = FingerprintJS (client) + hash header server (`src/lib/server-hash.ts`). IP mentah **tidak** disimpan.

Pesan tolak: *"Perangkat ini sudah digunakan untuk memberikan dukungan hari ini."*

---

## Setup

### 1. Buat project Supabase

[database.new](https://database.new) → catat **Project URL**, **anon key**, **service_role key** (Project Settings → API).

### 2. Aktifkan Anonymous sign-in

Supabase Dashboard → **Authentication → Sign In / Providers → Anonymous** → enable.
(Wajib — login voter pakai ini.)

### 3. Jalankan migration + seed

Urutan penting. Lewat Supabase SQL Editor, jalankan berurutan isi file:

```
supabase/migrations/0001_init.sql       # tabel, index, constraint, bucket storage
supabase/migrations/0002_functions.sql  # RPC cast_daily_vote, trigger poin, fungsi stats
supabase/migrations/0003_rls.sql        # Row Level Security
supabase/seed.sql                       # quest starter (sekolah tumbuh dari peserta)
```

Atau pakai Supabase CLI:

```bash
supabase db push          # apply migrations
supabase db execute -f supabase/seed.sql
```

### 3b. Buat akun admin

Admin dibuat lewat Admin API (bukan SQL — lebih andal):

```bash
npm run seed:admin                 # default 081200000000 / admin123
npm run seed:admin 0812xxxx rahasia  # custom phone & password
```

### 4. Environment

```bash
cp .env.example .env.local
```

Isi:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

### 5. Jalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

**Login admin default** (ganti sebelum produksi):
- Nomor WhatsApp: `081200000000`
- Password: `admin123`

---

## Alur Pakai

1. **Admin** login → `/admin/participants` → tambah peserta (nama, sekolah, foto, deskripsi). Sistem buat password peserta → salin & bagikan.
2. Admin atur sekolah (`/admin/schools`) & quest (`/admin/quests`).
3. **Voter** daftar (Nama + sekolahmu + sekolah peserta yang didukung + status + WA + password) → `/voter/dashboard` → lihat peserta dari **sekolah yang didukung** → Vote (+5/hari). Bisa kirim bukti quest.
4. **Peserta** login → `/participant/dashboard` → poin, ranking, grafik perkembangan, supporter terbesar.
5. Admin verifikasi quest di `/admin/submissions` → Approve → poin masuk otomatis (trigger DB).
6. Publik: `/ranking` (realtime), `/top-voter`.

## Routes

```
/                       Landing + leaderboard preview
/login                  Voter / Admin-Peserta
/voter/dashboard        Vote + quest (peserta sekolah yang didukung)
/participant/dashboard  Data diri, ranking, grafik, supporter
/admin                  Stats + chart (vote harian, pertumbuhan voter, peserta teratas)
/admin/participants     CRUD peserta + generate password
/admin/submissions      Verifikasi quest (approve/reject)
/admin/quests           CRUD quest
/admin/schools          CRUD sekolah
/ranking                Leaderboard realtime
/top-voter              Top 5 voter teraktif
```

## Deploy ke Vercel

1. Push repo ke Git.
2. Import di Vercel.
3. Set env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy.

## Struktur

```
src/
  app/            pages + api routes
  components/     ui (shadcn), navbar, charts, leaderboard, states, quest-panel
  lib/            supabase clients, fingerprint, server-hash, validations, queries, auth
  types/          database types
supabase/
  migrations/     0001 init · 0002 functions · 0003 rls
  seed.sql        schools + admin
middleware.ts     proteksi route per role
```

## Keamanan

- RLS aktif semua tabel. Voter cuma akses peserta sekolahnya; peserta cuma datanya; admin full.
- Vote lewat RPC `SECURITY DEFINER` pakai `auth.uid()` — client tak bisa vote atas nama orang lain.
- `service_role` key server-only (route handlers). Jangan expose ke browser.
