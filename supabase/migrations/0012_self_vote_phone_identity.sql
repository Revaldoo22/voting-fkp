-- =====================================================================
-- Migration 0012
--   * Block self-vote: a participant can't support their own entry
--     (matched by WhatsApp number on their linked profile)
--   * Phone identity: one WhatsApp number must always use the same name
--   Applies to both cast_vote and record_submission.
--   New codes: SELFVOTE, PHONE_NAME
-- =====================================================================

-- Helper: does this phone already exist under a DIFFERENT name?
create or replace function public.phone_name_conflict(p_phone text, p_name text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.daily_votes
    where voter_phone = p_phone
      and lower(trim(voter_name)) <> lower(trim(p_name))
    union all
    select 1 from public.submissions
    where voter_phone = p_phone
      and lower(trim(voter_name)) <> lower(trim(p_name))
    limit 1
  );
$$;

-- Helper: phone number of the participant's linked profile (for self-vote).
create or replace function public.participant_phone(p_participant_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select pr.phone_number
  from public.participants pa
  join public.profiles pr on pr.id = pa.profile_id
  where pa.id = p_participant_id;
$$;

-- ---------------------------------------------------------------------
-- cast_vote v2 — adds SELFVOTE + PHONE_NAME checks.
-- ---------------------------------------------------------------------
create or replace function public.cast_vote(
  p_participant_id uuid,
  p_fingerprint    text,
  p_name           text,
  p_phone          text,
  p_email          text,
  p_status         text,
  p_school         text default null,
  p_class          text default null,
  p_server_hash    text default null,
  p_ip_hash        text default null
)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_limit int;
  v_ip_count int;
  v_pphone   text;
  v_result   public.participants;
begin
  if not public.is_event_open() then
    raise exception 'EVENTCLOSED';
  end if;

  if p_fingerprint is null or length(trim(p_fingerprint)) = 0
     or p_name is null  or length(trim(p_name))  = 0
     or p_phone is null or length(trim(p_phone)) = 0
     or p_email is null or length(trim(p_email)) = 0
     or p_status is null or length(trim(p_status)) = 0 then
    raise exception 'MISSINGDATA';
  end if;

  if not exists (
    select 1 from public.participants
    where id = p_participant_id and status = 'active'
  ) then
    raise exception 'NOTFOUND';
  end if;

  -- Can't vote for yourself (match participant's WhatsApp number).
  v_pphone := public.participant_phone(p_participant_id);
  if v_pphone is not null and v_pphone = p_phone then
    raise exception 'SELFVOTE';
  end if;

  -- One WhatsApp number = one name.
  if public.phone_name_conflict(p_phone, p_name) then
    raise exception 'PHONE_NAME';
  end if;

  -- Already voted this participant today (device / phone / email)?
  if exists (
    select 1 from public.daily_votes
    where participant_id = p_participant_id
      and vote_date = current_date
      and (device_fingerprint = p_fingerprint
           or voter_phone = p_phone
           or voter_email = lower(p_email))
  ) then
    raise exception 'ALREADYVOTED';
  end if;

  if p_ip_hash is not null and length(p_ip_hash) > 0 then
    select ip_daily_limit into v_ip_limit from public.app_settings where id;
    select count(distinct voter_email) into v_ip_count
    from public.daily_votes
    where ip_hash = p_ip_hash and vote_date = current_date;
    if v_ip_count >= coalesce(v_ip_limit, 5) then
      raise exception 'IPLIMIT';
    end if;
  end if;

  insert into public.daily_votes
    (participant_id, device_fingerprint, server_hash, ip_hash,
     voter_name, voter_phone, voter_email, voter_status, voter_school, voter_class)
  values
    (p_participant_id, p_fingerprint, p_server_hash, p_ip_hash,
     trim(p_name), trim(p_phone), lower(trim(p_email)), p_status,
     nullif(trim(coalesce(p_school, '')), ''), nullif(trim(coalesce(p_class, '')), ''));

  update public.participants
  set total_points = total_points + 5
  where id = p_participant_id
  returning * into v_result;

  return v_result;
exception
  when unique_violation then
    raise exception 'ALREADYVOTED';
end;
$$;

grant execute on function
  public.cast_vote(uuid, text, text, text, text, text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------
-- record_submission v4 — adds SELFVOTE + PHONE_NAME checks.
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
  v_pphone  text;
begin
  if not public.is_event_open() then
    raise exception 'EVENTCLOSED';
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
