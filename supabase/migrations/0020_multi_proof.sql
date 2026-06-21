-- =====================================================================
-- Migration 0020 — Multiple proofs per submission (max 5)
--   submission_proofs: 1 submission -> banyak bukti (file/link), tiap
--   bukti punya url + url_norm. Link tetap unik global (dedup per-link).
--   record_submission menerima array bukti.
-- =====================================================================

create table if not exists public.submission_proofs (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  url           text not null,
  url_norm      text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_sp_submission on public.submission_proofs(submission_id);
create index if not exists idx_sp_norm on public.submission_proofs(url_norm);

alter table public.submission_proofs enable row level security;
drop policy if exists sp_select on public.submission_proofs;
create policy sp_select on public.submission_proofs
  for select using (true);
-- writes via record_submission (security definer / service role)

-- Backfill existing single proofs.
insert into public.submission_proofs (submission_id, url, url_norm)
select id, proof_url, proof_url_norm
from public.submissions
where proof_url is not null
  and not exists (
    select 1 from public.submission_proofs sp where sp.submission_id = submissions.id
  );

-- ---------------------------------------------------------------------
-- record_submission v5 — p_proof_urls text[] (1..5). proof_url menyimpan
-- bukti pertama (kompat). Dedup link dicek untuk SETIAP link.
-- ---------------------------------------------------------------------
drop function if exists public.record_submission(
  uuid, uuid, text, text, text, text, text, text, text, uuid);

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

  -- Once/daily guard.
  if v_freq = 'daily' then
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
