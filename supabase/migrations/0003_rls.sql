-- =====================================================================
-- Festival Karakter Pelajar Universitas STEKOM
-- Migration 0003 — Row Level Security policies
-- =====================================================================

alter table public.schools       enable row level security;
alter table public.profiles      enable row level security;
alter table public.participants  enable row level security;
alter table public.user_devices  enable row level security;
alter table public.quests        enable row level security;
alter table public.submissions   enable row level security;
alter table public.daily_votes   enable row level security;

-- =====================================================================
-- SCHOOLS — public read, admin write
-- =====================================================================
drop policy if exists schools_select on public.schools;
create policy schools_select on public.schools
  for select using (true);

drop policy if exists schools_admin_write on public.schools;
create policy schools_admin_write on public.schools
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- PROFILES
--  - own row read/update
--  - admin full
--  - (insert handled server-side via service role on signup)
-- =====================================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- PARTICIPANTS
--  - admin: full
--  - participant: their own linked row
--  - voter: only participants in their own school
--  - anon: read all (public leaderboard / ranking)
-- =====================================================================
drop policy if exists participants_select on public.participants;
create policy participants_select on public.participants
  for select using (
    public.is_admin()
    or auth.uid() is null                          -- public leaderboard (anon)
    or profile_id = auth.uid()                     -- participant own row
    or school_id = public.my_school_id()           -- voter same-school
    or public.my_school_id() is null               -- logged-in user w/o school sees public board
  );

drop policy if exists participants_admin_write on public.participants;
create policy participants_admin_write on public.participants
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- USER_DEVICES — own read, admin read; writes via SECURITY DEFINER RPC
-- =====================================================================
drop policy if exists user_devices_select_own on public.user_devices;
create policy user_devices_select_own on public.user_devices
  for select using (auth.uid() = user_id or public.is_admin());

-- =====================================================================
-- QUESTS — public read, admin write
-- =====================================================================
drop policy if exists quests_select on public.quests;
create policy quests_select on public.quests
  for select using (true);

drop policy if exists quests_admin_write on public.quests;
create policy quests_admin_write on public.quests
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- SUBMISSIONS
--  - user: read own, insert own (always pending)
--  - admin: read all, update status
-- =====================================================================
drop policy if exists submissions_select_own on public.submissions;
create policy submissions_select_own on public.submissions
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists submissions_insert_own on public.submissions;
create policy submissions_insert_own on public.submissions
  for insert with check (auth.uid() = user_id and status = 'pending');

drop policy if exists submissions_admin_update on public.submissions;
create policy submissions_admin_update on public.submissions
  for update using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- DAILY_VOTES
--  - user: read own only (a voter cannot see other voters' data)
--  - admin: read all
--  - inserts only via cast_daily_vote() SECURITY DEFINER RPC
-- =====================================================================
drop policy if exists daily_votes_select_own on public.daily_votes;
create policy daily_votes_select_own on public.daily_votes
  for select using (auth.uid() = user_id or public.is_admin());

-- =====================================================================
-- STORAGE policies
--  participant-photos : public read, admin write
--  quest-proofs       : public read, authenticated upload
-- =====================================================================
drop policy if exists storage_photos_read on storage.objects;
create policy storage_photos_read on storage.objects
  for select using (bucket_id in ('participant-photos', 'quest-proofs'));

drop policy if exists storage_photos_admin_write on storage.objects;
create policy storage_photos_admin_write on storage.objects
  for insert with check (bucket_id = 'participant-photos' and public.is_admin());

drop policy if exists storage_proofs_user_write on storage.objects;
create policy storage_proofs_user_write on storage.objects
  for insert with check (bucket_id = 'quest-proofs' and auth.uid() is not null);
