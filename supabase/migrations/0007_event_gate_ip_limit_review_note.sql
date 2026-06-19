-- =====================================================================
-- Migration 0007
--   * app_settings (event open/close toggle)
--   * daily_votes.ip_hash (secondary anti-cheat, soft limit)
--   * submissions.review_note (reject reason)
--   * cast_daily_vote: event-gate + IP soft-limit (account stays primary)
--   * submission insert: event-gate
-- =====================================================================

-- ---- Global settings (single row) -----------------------------------
create table if not exists public.app_settings (
  id             boolean primary key default true check (id),  -- single-row guard
  event_open     boolean not null default true,
  closed_message text not null default 'Event sedang ditutup. Sampai jumpa lagi!',
  ip_daily_limit int not null default 5,  -- max distinct accounts voting per IP/day
  updated_at     timestamptz not null default now()
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select using (true);

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- New columns ----------------------------------------------------
alter table public.daily_votes add column if not exists ip_hash text;
alter table public.submissions add column if not exists review_note text;

create index if not exists idx_daily_votes_ip on public.daily_votes(ip_hash, vote_date);

-- ---- Helper: is the event open? -------------------------------------
create or replace function public.is_event_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select event_open from public.app_settings where id), true);
$$;
grant execute on function public.is_event_open() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- cast_daily_vote — now event-gated, with IP soft-limit.
-- Account (user_id) + device remain the PRIMARY guards; ip_hash is a
-- secondary signal: block only if the same IP already drove more than
-- ip_daily_limit DISTINCT accounts to vote today (kills bulk farming
-- while tolerating shared wifi / schools).
-- New code: EVENTCLOSED, IPLIMIT.
-- ---------------------------------------------------------------------
create or replace function public.cast_daily_vote(
  p_participant_id uuid,
  p_fingerprint    text,
  p_server_hash    text default null,
  p_ip_hash        text default null
)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_school       uuid;
  v_p_school     uuid;
  v_device_owner uuid;
  v_ip_limit     int;
  v_ip_count     int;
  v_result       public.participants;
begin
  if v_uid is null then
    raise exception 'NOTLOGGEDIN';
  end if;

  if not public.is_event_open() then
    raise exception 'EVENTCLOSED';
  end if;

  if p_fingerprint is null or length(trim(p_fingerprint)) = 0 then
    raise exception 'NOFINGERPRINT';
  end if;

  select school_id into v_school from public.profiles where id = v_uid;

  select school_id into v_p_school
  from public.participants
  where id = p_participant_id and status = 'active';

  if v_p_school is null then
    raise exception 'NOTFOUND';
  end if;

  if v_school is null or v_p_school <> v_school then
    raise exception 'WRONGSCHOOL';
  end if;

  -- Device bound to a DIFFERENT account?
  select user_id into v_device_owner
  from public.user_devices
  where device_fingerprint = p_fingerprint;

  if v_device_owner is not null and v_device_owner <> v_uid then
    raise exception 'DEVICEMISMATCH';
  end if;

  if v_device_owner is null then
    insert into public.user_devices (user_id, device_fingerprint, server_hash)
    values (v_uid, p_fingerprint, p_server_hash)
    on conflict (device_fingerprint) do nothing;
  end if;

  -- Account already voted today?
  if exists (
    select 1 from public.daily_votes
    where user_id = v_uid and vote_date = current_date
  ) then
    raise exception 'ALREADYVOTED';
  end if;

  -- Device already voted today (any account)?
  if exists (
    select 1 from public.daily_votes
    where device_fingerprint = p_fingerprint and vote_date = current_date
  ) then
    raise exception 'DEVICEVOTED';
  end if;

  -- IP soft-limit: too many distinct accounts from one IP today?
  if p_ip_hash is not null and length(p_ip_hash) > 0 then
    select ip_daily_limit into v_ip_limit from public.app_settings where id;
    select count(distinct user_id) into v_ip_count
    from public.daily_votes
    where ip_hash = p_ip_hash and vote_date = current_date;
    if v_ip_count >= coalesce(v_ip_limit, 5) then
      raise exception 'IPLIMIT';
    end if;
  end if;

  insert into public.daily_votes
    (user_id, participant_id, device_fingerprint, server_hash, ip_hash)
  values (v_uid, p_participant_id, p_fingerprint, p_server_hash, p_ip_hash);

  update public.participants
  set total_points = total_points + 5
  where id = p_participant_id
  returning * into v_result;

  return v_result;
exception
  when unique_violation then
    raise exception 'DEVICEVOTED';
end;
$$;

revoke all on function public.cast_daily_vote(uuid, text, text, text) from public;
grant execute on function public.cast_daily_vote(uuid, text, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Submission gate: also block submissions when the event is closed
-- (extends the existing once/daily guard from migration 0005).
-- ---------------------------------------------------------------------
create or replace function public.check_submission_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_freq text;
begin
  if not public.is_event_open() then
    raise exception 'EVENTCLOSED';
  end if;

  select frequency into v_freq from public.quests where id = new.quest_id;

  if v_freq = 'daily' then
    if exists (
      select 1 from public.submissions
      where user_id = new.user_id
        and quest_id = new.quest_id
        and participant_id = new.participant_id
        and submit_date = current_date
        and status <> 'rejected'
    ) then
      raise exception 'DAILY_DONE';
    end if;
  else
    if exists (
      select 1 from public.submissions
      where user_id = new.user_id
        and quest_id = new.quest_id
        and participant_id = new.participant_id
        and status <> 'rejected'
    ) then
      raise exception 'ALREADY_DONE';
    end if;
  end if;

  return new;
end;
$$;
