-- =====================================================================
-- Migration 0026 — Follow quests jadi "sekali untuk seluruh event"
--   Follow itu mem-follow akun STEKOM/Toploker (akun univ), bukan akun
--   peserta. Jadi tiap voter cuma perlu follow SEKALI, lalu quest follow
--   dianggap selesai untuk SEMUA peserta — tak bisa diulang di peserta lain.
--
--   Tambah frequency 'global':
--     once   -> sekali per (voter, quest, peserta)
--     daily  -> sekali per hari per (voter, quest, peserta)
--     global -> sekali per (voter, quest) lintas semua peserta
--   New error code: GLOBAL_DONE
-- =====================================================================

-- ---- Izinkan nilai frequency 'global' -------------------------------
alter table public.quests
  drop constraint if exists quests_frequency_check;
alter table public.quests
  add constraint quests_frequency_check
    check (frequency in ('once', 'daily', 'global'));

-- ---- Set 4 quest follow ke 'global' ---------------------------------
update public.quests
set frequency = 'global'
where name in (
  'Follow Instagram STEKOM',
  'Follow TikTok STEKOM',
  'Follow Instagram Toploker',
  'Follow TikTok Toploker'
);

-- ---------------------------------------------------------------------
-- record_submission v6 — tambah guard 'global' (cek tanpa participant_id).
-- Selebihnya identik dengan v5 (migration 0020).
-- ---------------------------------------------------------------------
create or replace function public.record_submission(
  p_participant_id uuid,
  p_quest_id       uuid,
  p_proof_urls     text[],
  p_name           text,
  p_phone          text,
  p_email          text,
  p_status         text,
  p_school         text default null,
  p_class          text default null,
  p_content_id     uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_freq    text;
  v_ptype   text;
  v_ckind   text;
  v_email   text := lower(trim(p_email));
  v_pphone  text;
  v_url     text;
  v_norm    text;
  v_sub_id  uuid;
  v_count   int := coalesce(array_length(p_proof_urls, 1), 0);
begin
  if not public.is_event_open() then
    raise exception 'EVENTCLOSED';
  end if;

  if v_count < 1 then
    raise exception 'MISSINGDATA';
  end if;
  if v_count > 5 then
    raise exception 'TOOMANY';
  end if;

  v_pphone := public.participant_phone(p_participant_id);
  if v_pphone is not null and v_pphone = p_phone then
    raise exception 'SELFVOTE';
  end if;

  if public.phone_name_conflict(p_phone, p_name) then
    raise exception 'PHONE_NAME';
  end if;

  select frequency, proof_type, content_kind
    into v_freq, v_ptype, v_ckind
  from public.quests where id = p_quest_id;

  if v_ckind is not null then
    if p_content_id is null then
      raise exception 'CONTENT_REQUIRED';
    end if;
    if not exists (
      select 1 from public.participant_contents
      where id = p_content_id and participant_id = p_participant_id and kind = v_ckind
    ) then
      raise exception 'CONTENT_INVALID';
    end if;
  end if;

  -- Global link de-dup per link (only for link-proof quests).
  if v_ptype = 'link' then
    foreach v_url in array p_proof_urls loop
      v_norm := public.normalize_link(v_url);
      if exists (
        select 1
        from public.submission_proofs sp
        join public.submissions s on s.id = sp.submission_id
        where sp.url_norm = v_norm and s.status <> 'rejected'
      ) then
        raise exception 'DUPLICATE_LINK';
      end if;
    end loop;
  end if;

  -- Frequency guard.
  if v_freq = 'global' then
    -- Sekali per (voter, quest) lintas SEMUA peserta.
    if exists (
      select 1 from public.submissions
      where quest_id = p_quest_id
        and voter_email = v_email and status <> 'rejected'
    ) then
      raise exception 'GLOBAL_DONE';
    end if;
  elsif v_freq = 'daily' then
    if exists (
      select 1 from public.submissions
      where quest_id = p_quest_id and participant_id = p_participant_id
        and voter_email = v_email and submit_date = current_date
        and status <> 'rejected'
        and (p_content_id is null or content_id = p_content_id)
    ) then
      raise exception 'DAILY_DONE';
    end if;
  else
    if exists (
      select 1 from public.submissions
      where quest_id = p_quest_id and participant_id = p_participant_id
        and voter_email = v_email and status <> 'rejected'
        and (p_content_id is null or content_id = p_content_id)
    ) then
      raise exception 'ALREADY_DONE';
    end if;
  end if;

  insert into public.submissions
    (participant_id, quest_id, content_id, proof_url, proof_url_norm, status,
     voter_name, voter_phone, voter_email, voter_status, voter_school, voter_class)
  values
    (p_participant_id, p_quest_id, p_content_id,
     p_proof_urls[1], public.normalize_link(p_proof_urls[1]), 'pending',
     trim(p_name), trim(p_phone), v_email, p_status,
     nullif(trim(coalesce(p_school, '')), ''), nullif(trim(coalesce(p_class, '')), ''))
  returning id into v_sub_id;

  foreach v_url in array p_proof_urls loop
    insert into public.submission_proofs (submission_id, url, url_norm)
    values (v_sub_id, v_url, public.normalize_link(v_url));
  end loop;
end;
$$;

grant execute on function
  public.record_submission(uuid, uuid, text[], text, text, text, text, text, text, uuid)
  to service_role;
