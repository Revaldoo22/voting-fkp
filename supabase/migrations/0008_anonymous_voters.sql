-- =====================================================================
-- Migration 0008 — Anonymous voters (no voter accounts)
--
-- Voters no longer have accounts. Home lists all participants publicly;
-- voting/quest is done by filling a form (name, phone, email, status,
-- optional school + class). Daily vote and quest features REMAIN.
--
--   * daily_votes / submissions gain voter_* columns; user_id -> nullable
--   * anti-cheat is now per participant per day, keyed by
--     device fingerprint, phone, AND email
--   * cast_vote() RPC replaces cast_daily_vote() (no auth.uid)
--   * supporters / top voters / point history group by voter_email
-- =====================================================================

-- ---- daily_votes ----------------------------------------------------
alter table public.daily_votes
  add column if not exists voter_name   text,
  add column if not exists voter_phone  text,
  add column if not exists voter_email  text,
  add column if not exists voter_status text,
  add column if not exists voter_school text,
  add column if not exists voter_class  text;

alter table public.daily_votes alter column user_id drop not null;

-- Drop the old account/device daily-uniqueness (was global per day).
alter table public.daily_votes drop constraint if exists daily_votes_user_id_vote_date_key;
alter table public.daily_votes drop constraint if exists daily_votes_device_fingerprint_vote_date_key;

-- New rule: one vote PER PARTICIPANT PER DAY per device / phone / email.
-- (A voter may support several participants, but each at most once a day.)
do $$ begin
  alter table public.daily_votes
    add constraint dv_uniq_device unique (participant_id, device_fingerprint, vote_date);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.daily_votes
    add constraint dv_uniq_phone unique (participant_id, voter_phone, vote_date);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.daily_votes
    add constraint dv_uniq_email unique (participant_id, voter_email, vote_date);
exception when duplicate_object then null; end $$;

create index if not exists idx_dv_email on public.daily_votes(voter_email);

-- ---- submissions ----------------------------------------------------
alter table public.submissions
  add column if not exists voter_name   text,
  add column if not exists voter_phone  text,
  add column if not exists voter_email  text,
  add column if not exists voter_status text,
  add column if not exists voter_school text,
  add column if not exists voter_class  text;

alter table public.submissions alter column user_id drop not null;
create index if not exists idx_sub_email on public.submissions(voter_email);

-- ---------------------------------------------------------------------
-- cast_vote — anonymous daily vote. Called from the server with the
-- service role (no auth.uid). All anti-cheat checks live here so the
-- rule holds regardless of client.
--   Codes: EVENTCLOSED, NOTFOUND, ALREADYVOTED (device/phone/email),
--          IPLIMIT, MISSINGDATA
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

  -- Already voted this participant today (by device, phone, or email)?
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

  -- IP soft-limit: too many distinct emails from one IP today.
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
-- record_submission — anonymous quest submission (service role).
-- Enforces event-open + once/daily rules keyed by voter_email.
--   Codes: EVENTCLOSED, DAILY_DONE, ALREADY_DONE
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
  v_email text := lower(trim(p_email));
begin
  if not public.is_event_open() then
    raise exception 'EVENTCLOSED';
  end if;

  select frequency into v_freq from public.quests where id = p_quest_id;

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
    (participant_id, quest_id, proof_url, status,
     voter_name, voter_phone, voter_email, voter_status, voter_school, voter_class)
  values
    (p_participant_id, p_quest_id, p_proof_url, 'pending',
     trim(p_name), trim(p_phone), v_email, p_status,
     nullif(trim(coalesce(p_school, '')), ''), nullif(trim(coalesce(p_class, '')), ''));
end;
$$;

grant execute on function
  public.record_submission(uuid, uuid, text, text, text, text, text, text, text)
  to service_role;

-- The old once/daily insert trigger keyed off user_id; the new RPC owns
-- those checks. Drop the trigger to avoid conflicts.
drop trigger if exists trg_check_submission_allowed on public.submissions;

-- ---------------------------------------------------------------------
-- Supporters / top voters / point history — now grouped by voter_email.
-- ---------------------------------------------------------------------
create or replace function public.top_supporters(p_participant_id uuid, p_limit int default 5)
returns table (voter_name text, votes bigint, points bigint)
language sql stable security definer set search_path = public
as $$
  with vote_pts as (
    select voter_email, max(voter_name) as nm, count(*) as votes, count(*) * 5 as pts
    from public.daily_votes
    where participant_id = p_participant_id and voter_email is not null
    group by voter_email
  ),
  quest_pts as (
    select s.voter_email, coalesce(sum(q.point), 0) as pts
    from public.submissions s
    join public.quests q on q.id = s.quest_id
    where s.participant_id = p_participant_id and s.status = 'approved'
      and s.voter_email is not null
    group by s.voter_email
  ),
  combined as (
    select coalesce(v.voter_email, qp.voter_email) as email,
           coalesce(v.nm, qp.voter_email)          as nm,
           coalesce(v.votes, 0)                    as votes,
           coalesce(v.pts, 0) + coalesce(qp.pts, 0) as points
    from vote_pts v
    full outer join quest_pts qp on qp.voter_email = v.voter_email
  )
  select nm as voter_name, votes, points
  from combined
  where points > 0
  order by points desc
  limit p_limit;
$$;
grant execute on function public.top_supporters(uuid, int) to anon, authenticated, service_role;

create or replace function public.participant_point_history(p_participant_id uuid)
returns table (day date, points bigint, cumulative bigint)
language sql stable security definer set search_path = public
as $$
  with vote_day as (
    select vote_date as day, count(*) * 5 as pts
    from public.daily_votes
    where participant_id = p_participant_id
    group by vote_date
  ),
  quest_day as (
    select s.created_at::date as day, coalesce(sum(q.point), 0) as pts
    from public.submissions s
    join public.quests q on q.id = s.quest_id
    where s.participant_id = p_participant_id and s.status = 'approved'
    group by s.created_at::date
  ),
  merged as (
    select day, sum(pts) as points
    from (select day, pts from vote_day union all select day, pts from quest_day) u
    group by day
  )
  select day, points, sum(points) over (order by day) as cumulative
  from merged order by day;
$$;
grant execute on function public.participant_point_history(uuid) to anon, authenticated, service_role;

create or replace function public.top_voters(p_limit int default 5)
returns table (voter_name text, school_name text, votes bigint, quests bigint, score bigint)
language sql stable security definer set search_path = public
as $$
  with v as (
    select voter_email, max(voter_name) as nm, max(voter_school) as school, count(*) as votes
    from public.daily_votes where voter_email is not null group by voter_email
  ),
  q as (
    select s.voter_email, count(*) as quests, coalesce(sum(qu.point), 0) as quest_points
    from public.submissions s
    join public.quests qu on qu.id = s.quest_id
    where s.status = 'approved' and s.voter_email is not null
    group by s.voter_email
  )
  select coalesce(v.nm, v.voter_email)          as voter_name,
         v.school                                as school_name,
         coalesce(v.votes, 0)                    as votes,
         coalesce(q.quests, 0)                   as quests,
         (coalesce(v.votes, 0) * 5 + coalesce(q.quest_points, 0)) as score
  from v
  left join q on q.voter_email = v.voter_email
  where (coalesce(v.votes, 0) > 0 or coalesce(q.quests, 0) > 0)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.top_voters(int) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Participants must be publicly readable (home lists everyone now).
-- ---------------------------------------------------------------------
drop policy if exists participants_select on public.participants;
create policy participants_select on public.participants
  for select using (true);

-- Anonymous voters upload quest proofs (no auth). Allow anon inserts to the
-- quest-proofs bucket. (The submission row itself is created server-side via
-- record_submission with the service role.)
drop policy if exists storage_proofs_user_write on storage.objects;
create policy storage_proofs_anon_write on storage.objects
  for insert with check (bucket_id = 'quest-proofs');
