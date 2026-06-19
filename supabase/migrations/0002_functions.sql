-- =====================================================================
-- Festival Karakter Pelajar Universitas STEKOM
-- Migration 0002 — Functions, triggers, vote RPC
-- =====================================================================

-- ---------------------------------------------------------------------
-- is_admin() — used by RLS policies. SECURITY DEFINER so the policy
-- check itself is not blocked by RLS on profiles.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- my_school_id() — school of the currently authenticated user.
-- ---------------------------------------------------------------------
create or replace function public.my_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- cast_daily_vote(participant_id, fingerprint, server_hash)
-- Transactional daily vote with full anti-cheat enforcement.
-- Runs as SECURITY DEFINER but always uses auth.uid() as the actor,
-- so a client cannot vote on behalf of someone else.
--
-- Raises with coded messages the API maps to user-facing toasts:
--   NOTLOGGEDIN     -> session invalid
--   WRONGSCHOOL     -> participant not in voter's school
--   ALREADYVOTED    -> this account already voted today
--   DEVICEVOTED     -> this device already voted today (any account)
--   DEVICEMISMATCH  -> device belongs to another account
-- ---------------------------------------------------------------------
create or replace function public.cast_daily_vote(
  p_participant_id uuid,
  p_fingerprint    text,
  p_server_hash    text default null
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
  v_result       public.participants;
begin
  if v_uid is null then
    raise exception 'NOTLOGGEDIN';
  end if;

  if p_fingerprint is null or length(trim(p_fingerprint)) = 0 then
    raise exception 'NOFINGERPRINT';
  end if;

  -- voter's school
  select school_id into v_school from public.profiles where id = v_uid;

  -- participant must exist, be active, and be in the voter's school
  select school_id into v_p_school
  from public.participants
  where id = p_participant_id and status = 'active';

  if v_p_school is null then
    raise exception 'NOTFOUND';
  end if;

  if v_school is null or v_p_school <> v_school then
    raise exception 'WRONGSCHOOL';
  end if;

  -- This device must not already belong to a DIFFERENT account.
  select user_id into v_device_owner
  from public.user_devices
  where device_fingerprint = p_fingerprint;

  if v_device_owner is not null and v_device_owner <> v_uid then
    raise exception 'DEVICEMISMATCH';
  end if;

  -- Bind device to this account if not yet bound.
  if v_device_owner is null then
    insert into public.user_devices (user_id, device_fingerprint, server_hash)
    values (v_uid, p_fingerprint, p_server_hash)
    on conflict (device_fingerprint) do nothing;
  end if;

  -- Already voted today with this account?
  if exists (
    select 1 from public.daily_votes
    where user_id = v_uid and vote_date = current_date
  ) then
    raise exception 'ALREADYVOTED';
  end if;

  -- Already voted today from this device (any account)?
  if exists (
    select 1 from public.daily_votes
    where device_fingerprint = p_fingerprint and vote_date = current_date
  ) then
    raise exception 'DEVICEVOTED';
  end if;

  -- Record the vote (unique constraints are the final guard against races).
  insert into public.daily_votes (user_id, participant_id, device_fingerprint, server_hash)
  values (v_uid, p_participant_id, p_fingerprint, p_server_hash);

  update public.participants
  set total_points = total_points + 5
  where id = p_participant_id
  returning * into v_result;

  return v_result;
exception
  when unique_violation then
    -- Concurrent double-submit lands here.
    raise exception 'DEVICEVOTED';
end;
$$;

revoke all on function public.cast_daily_vote(uuid, text, text) from public;
grant execute on function public.cast_daily_vote(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Trigger: when a submission flips to 'approved', add quest points to
-- the participant exactly once (only on a real pending->approved change).
-- ---------------------------------------------------------------------
create or replace function public.apply_submission_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_point integer;
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    select point into v_point from public.quests where id = new.quest_id;
    update public.participants
    set total_points = total_points + coalesce(v_point, 0)
    where id = new.participant_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_submission_points on public.submissions;
create trigger trg_apply_submission_points
  after update on public.submissions
  for each row execute function public.apply_submission_points();

-- ---------------------------------------------------------------------
-- participant_point_history(p_participant_id) — daily cumulative points
-- (votes only) for the participant growth chart on their dashboard.
-- ---------------------------------------------------------------------
create or replace function public.participant_point_history(p_participant_id uuid)
returns table (day date, points bigint, cumulative bigint)
language sql
stable
security definer
set search_path = public
as $$
  with daily as (
    select vote_date as day, count(*) * 5 as points
    from public.daily_votes
    where participant_id = p_participant_id
    group by vote_date
  )
  select day,
         points,
         sum(points) over (order by day) as cumulative
  from daily
  order by day;
$$;

grant execute on function public.participant_point_history(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- participant_rank(p_participant_id) — 1-based rank by total_points.
-- ---------------------------------------------------------------------
create or replace function public.participant_rank(p_participant_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select rnk::int from (
    select id, rank() over (order by total_points desc) as rnk
    from public.participants
    where status = 'active'
  ) r
  where id = p_participant_id;
$$;

grant execute on function public.participant_rank(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- top_supporters(p_participant_id) — voters who contributed most points
-- to a participant (each daily vote = 5 pts). For "supporter terbesar".
-- ---------------------------------------------------------------------
create or replace function public.top_supporters(p_participant_id uuid, p_limit int default 5)
returns table (voter_name text, votes bigint, points bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.name as voter_name,
         count(*) as votes,
         count(*) * 5 as points
  from public.daily_votes dv
  join public.profiles p on p.id = dv.user_id
  where dv.participant_id = p_participant_id
  group by p.name
  order by points desc
  limit p_limit;
$$;

grant execute on function public.top_supporters(uuid, int) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- top_voters(p_limit) — most active voters: vote count + approved quests.
-- Activity score = votes*5 + approved-quest points contributed.
-- ---------------------------------------------------------------------
create or replace function public.top_voters(p_limit int default 5)
returns table (voter_name text, school_name text, votes bigint, quests bigint, score bigint)
language sql
stable
security definer
set search_path = public
as $$
  with v as (
    select user_id, count(*) as votes
    from public.daily_votes group by user_id
  ),
  q as (
    select s.user_id, count(*) as quests, coalesce(sum(qu.point), 0) as quest_points
    from public.submissions s
    join public.quests qu on qu.id = s.quest_id
    where s.status = 'approved'
    group by s.user_id
  )
  select p.name as voter_name,
         sch.name as school_name,
         coalesce(v.votes, 0)  as votes,
         coalesce(q.quests, 0) as quests,
         (coalesce(v.votes, 0) * 5 + coalesce(q.quest_points, 0)) as score
  from public.profiles p
  left join v on v.user_id = p.id
  left join q on q.user_id = p.id
  left join public.schools sch on sch.id = p.school_id
  where p.role = 'voter'
    and (coalesce(v.votes, 0) > 0 or coalesce(q.quests, 0) > 0)
  order by score desc
  limit p_limit;
$$;

grant execute on function public.top_voters(int) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- admin_stats() — dashboard cards.
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns table (
  total_schools      bigint,
  total_participants bigint,
  total_voters       bigint,
  total_votes        bigint,
  total_points       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.schools),
    (select count(*) from public.participants),
    (select count(*) from public.profiles where role = 'voter'),
    (select count(*) from public.daily_votes),
    (select coalesce(sum(total_points), 0) from public.participants);
$$;

grant execute on function public.admin_stats() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- daily_vote_series(p_days) — votes per day for the admin chart.
-- ---------------------------------------------------------------------
create or replace function public.daily_vote_series(p_days int default 14)
returns table (day date, votes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select d::date as day,
         coalesce((select count(*) from public.daily_votes dv where dv.vote_date = d::date), 0) as votes
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
  order by day;
$$;

grant execute on function public.daily_vote_series(int) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- voter_growth_series(p_days) — cumulative voter signups per day.
-- ---------------------------------------------------------------------
create or replace function public.voter_growth_series(p_days int default 14)
returns table (day date, cumulative bigint)
language sql
stable
security definer
set search_path = public
as $$
  select d::date as day,
         (select count(*) from public.profiles p
          where p.role = 'voter' and p.created_at::date <= d::date) as cumulative
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
  order by day;
$$;

grant execute on function public.voter_growth_series(int) to authenticated, service_role;
