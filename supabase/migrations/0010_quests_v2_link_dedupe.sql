-- =====================================================================
-- Migration 0010
--   * Replace quest list with the 7 new quests
--   * Global link de-duplication for link-proof quests
--     (a given post link can be submitted only once across the whole event)
-- =====================================================================

-- ---- Link normalization --------------------------------------------
-- Canonicalize a URL so trivially-different forms map to the same key:
-- lowercase, strip protocol, strip "www.", drop query/fragment, drop
-- trailing slash. e.g.
--   https://www.instagram.com/reels/ABC/?igsh=x  ->  instagram.com/reels/abc
create or replace function public.normalize_link(p_url text)
returns text
language sql
immutable
as $$
  select case
    when p_url is null then null
    else trim(both '/' from
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(p_url)), '^https?://', ''),  -- drop scheme
          '^www\.', ''                                            -- drop www.
        ),
        '[?#].*$', ''                                             -- drop query/hash
      )
    )
  end;
$$;

-- Store the normalized form so we can check duplicates cheaply.
alter table public.submissions
  add column if not exists proof_url_norm text;

-- Backfill existing rows.
update public.submissions
set proof_url_norm = public.normalize_link(proof_url)
where proof_url_norm is null;

create index if not exists idx_sub_proof_norm on public.submissions(proof_url_norm);

-- ---- Replace quests -------------------------------------------------
-- "Ganti total": remove old quests (cascade removes their submissions),
-- then insert the 7 new ones. proof_type 'file' = screenshot upload,
-- 'link' = post URL. ref_link = akun/sound reference (edit via admin).
delete from public.quests;

insert into public.quests (name, description, point, status, proof_type, frequency) values
  ('Follow Instagram STEKOM',
   'Follow akun Instagram resmi STEKOM, lalu upload screenshot bukti follow.',
   10, 'active', 'file', 'once'),
  ('Follow TikTok STEKOM',
   'Follow akun TikTok resmi STEKOM, lalu upload screenshot bukti follow.',
   10, 'active', 'file', 'once'),
  ('Follow Instagram Toploker',
   'Follow akun Instagram Toploker, lalu upload screenshot bukti follow.',
   10, 'active', 'file', 'once'),
  ('Follow TikTok Toploker',
   'Follow akun TikTok Toploker, lalu upload screenshot bukti follow.',
   10, 'active', 'file', 'once'),
  ('Bikin Konten Dukungan',
   'Buat konten (video/reel) dukungan untuk peserta, posting, lalu kirim link postingannya.',
   50, 'active', 'link', 'once'),
  ('Like, Komen, Repost Video Peserta',
   'Like, komentari, dan repost video peserta, lalu upload screenshot buktinya.',
   20, 'active', 'file', 'once'),
  ('Konten Pakai Sound Video Peserta',
   'Buat konten TikTok memakai sound yang ada di video peserta, lalu kirim link kontenmu.',
   50, 'active', 'link', 'once');

-- ---------------------------------------------------------------------
-- record_submission v2 — adds global link de-dup for link-proof quests.
--   New code: DUPLICATE_LINK
-- ---------------------------------------------------------------------
create or replace function public.record_submission(
  p_participant_id uuid,
  p_quest_id       uuid,
  p_proof_url      text,
  p_name           text,
  p_phone          text,
  p_email          text,
  p_status         text,
  p_school         text default null,
  p_class          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_freq  text;
  v_ptype text;
  v_email text := lower(trim(p_email));
  v_norm  text := public.normalize_link(p_proof_url);
begin
  if not public.is_event_open() then
    raise exception 'EVENTCLOSED';
  end if;

  select frequency, proof_type into v_freq, v_ptype
  from public.quests where id = p_quest_id;

  -- Global link de-dup (only for link-proof quests).
  if v_ptype = 'link' then
    if exists (
      select 1 from public.submissions
      where proof_url_norm = v_norm and status <> 'rejected'
    ) then
      raise exception 'DUPLICATE_LINK';
    end if;
  end if;

  if v_freq = 'daily' then
    if exists (
      select 1 from public.submissions
      where quest_id = p_quest_id and participant_id = p_participant_id
        and voter_email = v_email and submit_date = current_date
        and status <> 'rejected'
    ) then
      raise exception 'DAILY_DONE';
    end if;
  else
    if exists (
      select 1 from public.submissions
      where quest_id = p_quest_id and participant_id = p_participant_id
        and voter_email = v_email and status <> 'rejected'
    ) then
      raise exception 'ALREADY_DONE';
    end if;
  end if;

  insert into public.submissions
    (participant_id, quest_id, proof_url, proof_url_norm, status,
     voter_name, voter_phone, voter_email, voter_status, voter_school, voter_class)
  values
    (p_participant_id, p_quest_id, p_proof_url, v_norm, 'pending',
     trim(p_name), trim(p_phone), v_email, p_status,
     nullif(trim(coalesce(p_school, '')), ''), nullif(trim(coalesce(p_class, '')), ''));
end;
$$;

grant execute on function
  public.record_submission(uuid, uuid, text, text, text, text, text, text, text)
  to service_role;
