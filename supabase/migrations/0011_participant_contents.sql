-- =====================================================================
-- Migration 0011 — Participant contents
--   Participants post their own content links. Voters pick one when doing
--   the "like/komen/repost" (engage) and "pakai sound" (sound) quests, then
--   submit proof. Admin sees the chosen content link + the voter's proof.
-- =====================================================================

create table if not exists public.participant_contents (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  kind           text not null check (kind in ('engage', 'sound')),
  url            text not null,
  label          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_pc_participant on public.participant_contents(participant_id, kind);

alter table public.participant_contents enable row level security;

-- Public read (voters need to pick from them).
drop policy if exists pc_select on public.participant_contents;
create policy pc_select on public.participant_contents for select using (true);

-- Admin full write; participant manages their own rows.
drop policy if exists pc_admin on public.participant_contents;
create policy pc_admin on public.participant_contents
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists pc_owner_write on public.participant_contents;
create policy pc_owner_write on public.participant_contents
  for all
  using (
    participant_id in (
      select id from public.participants where profile_id = auth.uid()
    )
  )
  with check (
    participant_id in (
      select id from public.participants where profile_id = auth.uid()
    )
  );

-- ---- Quest: which participant-content kind it needs (if any) --------
alter table public.quests
  add column if not exists content_kind text
    check (content_kind in ('engage', 'sound'));

update public.quests set content_kind = 'engage'
  where name = 'Like, Komen, Repost Video Peserta';
update public.quests set content_kind = 'sound'
  where name = 'Konten Pakai Sound Video Peserta';

-- ---- Submission references the chosen content ----------------------
alter table public.submissions
  add column if not exists content_id uuid references public.participant_contents(id) on delete set null;

-- ---------------------------------------------------------------------
-- record_submission v3 — accepts a chosen participant content id.
-- Validates it belongs to the participant and matches the quest's
-- content_kind. Codes add: CONTENT_REQUIRED, CONTENT_INVALID.
-- ---------------------------------------------------------------------
drop function if exists public.record_submission(uuid, uuid, text, text, text, text, text, text, text);

create or replace function public.record_submission(
  p_participant_id uuid,
  p_quest_id       uuid,
  p_proof_url      text,
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
  v_norm    text := public.normalize_link(p_proof_url);
begin
  if not public.is_event_open() then
    raise exception 'EVENTCLOSED';
  end if;

  select frequency, proof_type, content_kind
    into v_freq, v_ptype, v_ckind
  from public.quests where id = p_quest_id;

  -- Quest needs a participant content selection.
  if v_ckind is not null then
    if p_content_id is null then
      raise exception 'CONTENT_REQUIRED';
    end if;
    if not exists (
      select 1 from public.participant_contents
      where id = p_content_id
        and participant_id = p_participant_id
        and kind = v_ckind
    ) then
      raise exception 'CONTENT_INVALID';
    end if;
  end if;

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
    (p_participant_id, p_quest_id, p_content_id, p_proof_url, v_norm, 'pending',
     trim(p_name), trim(p_phone), v_email, p_status,
     nullif(trim(coalesce(p_school, '')), ''), nullif(trim(coalesce(p_class, '')), ''));
end;
$$;

grant execute on function
  public.record_submission(uuid, uuid, text, text, text, text, text, text, text, uuid)
  to service_role;
