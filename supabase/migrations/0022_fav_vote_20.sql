-- =====================================================================
-- Migration 0022 — Vote favorit (+20)
--   Jenis vote kedua: 'fav20' (+20 poin), reset harian seperti 'daily5'
--   (1x/peserta/hari), TAPI voter maks 10 peserta/hari untuk fav20.
--   Terpisah dari +5 (satu peserta bisa dapat +5 dan +20 di hari sama).
--
--   Karena ada 2 nilai poin, daily_votes kini simpan kolom `points`,
--   dan semua agregasi poin diubah dari count*5 -> sum(points).
-- =====================================================================

alter table public.daily_votes
  add column if not exists vote_kind text not null default 'daily5'
    check (vote_kind in ('daily5', 'fav20')),
  add column if not exists points int not null default 5;

-- Existing rows: kind default 'daily5', points default 5 (sudah benar).

-- Ganti unik harian agar per-jenis (boleh +5 dan +20 di hari sama).
alter table public.daily_votes drop constraint if exists dv_uniq_device;
alter table public.daily_votes drop constraint if exists dv_uniq_phone;
alter table public.daily_votes drop constraint if exists dv_uniq_email;

do $$ begin
  alter table public.daily_votes
    add constraint dv_uniq_device unique (participant_id, device_fingerprint, vote_date, vote_kind);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.daily_votes
    add constraint dv_uniq_phone unique (participant_id, voter_phone, vote_date, vote_kind);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.daily_votes
    add constraint dv_uniq_email unique (participant_id, voter_email, vote_date, vote_kind);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- cast_vote v3 — p_kind ('daily5'|'fav20'). Points dari kind.
--   fav20: maks 10 peserta berbeda per voter (by phone) per hari.
--   New code: FAV_LIMIT.
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
  p_ip_hash        text default null,
  p_kind           text default 'daily5'
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
  v_points   int := case when p_kind = 'fav20' then 20 else 5 end;
  v_fav_used int;
  v_result   public.participants;
begin
  if not public.is_event_open() then
    raise exception 'EVENTCLOSED';
  end if;

  if p_kind not in ('daily5', 'fav20') then
    raise exception 'BADKIND';
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

  v_pphone := public.participant_phone(p_participant_id);
  if v_pphone is not null and v_pphone = p_phone then
    raise exception 'SELFVOTE';
  end if;

  if public.phone_name_conflict(p_phone, p_name) then
    raise exception 'PHONE_NAME';
  end if;

  -- Sudah vote jenis ini untuk peserta ini hari ini?
  if exists (
    select 1 from public.daily_votes
    where participant_id = p_participant_id
      and vote_date = current_date
      and vote_kind = p_kind
      and (device_fingerprint = p_fingerprint
           or voter_phone = p_phone
           or voter_email = lower(p_email))
  ) then
    raise exception 'ALREADYVOTED';
  end if;

  -- fav20: maks 10 peserta berbeda per voter per hari.
  if p_kind = 'fav20' then
    select count(distinct participant_id) into v_fav_used
    from public.daily_votes
    where vote_kind = 'fav20' and vote_date = current_date
      and voter_phone = p_phone;
    if v_fav_used >= 10 then
      raise exception 'FAV_LIMIT';
    end if;
  end if;

  -- IP soft-limit (lintas jenis).
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
    (participant_id, device_fingerprint, server_hash, ip_hash, vote_kind, points,
     voter_name, voter_phone, voter_email, voter_status, voter_school, voter_class)
  values
    (p_participant_id, p_fingerprint, p_server_hash, p_ip_hash, p_kind, v_points,
     trim(p_name), trim(p_phone), lower(trim(p_email)), p_status,
     nullif(trim(coalesce(p_school, '')), ''), nullif(trim(coalesce(p_class, '')), ''));

  update public.participants
  set total_points = total_points + v_points
  where id = p_participant_id
  returning * into v_result;

  return v_result;
exception
  when unique_violation then
    raise exception 'ALREADYVOTED';
end;
$$;

grant execute on function
  public.cast_vote(uuid, text, text, text, text, text, text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------
-- Agregasi poin: count*5 -> sum(points). Vote count tetap count(*).
-- ---------------------------------------------------------------------

-- top_supporters (nama + status)
create or replace function public.top_supporters(p_participant_id uuid, p_limit int default 5)
returns table (voter_name text, voter_status text, votes bigint, points bigint)
language sql stable security definer set search_path = public
as $$
  with vote_pts as (
    select voter_phone, max(voter_name) as nm, max(voter_status) as st,
           count(*) as votes, coalesce(sum(points), 0) as pts
    from public.daily_votes
    where participant_id = p_participant_id and voter_phone is not null
    group by voter_phone
  ),
  quest_pts as (
    select s.voter_phone, max(s.voter_name) as nm, max(s.voter_status) as st,
           coalesce(sum(q.point), 0) as pts
    from public.submissions s
    join public.quests q on q.id = s.quest_id
    where s.participant_id = p_participant_id and s.status = 'approved'
      and s.voter_phone is not null
    group by s.voter_phone
  ),
  combined as (
    select coalesce(v.voter_phone, qp.voter_phone)              as phone,
           coalesce(v.nm, qp.nm, v.voter_phone, qp.voter_phone) as nm,
           coalesce(v.st, qp.st)                                as st,
           coalesce(v.votes, 0)                                 as votes,
           coalesce(v.pts, 0) + coalesce(qp.pts, 0)             as points
    from vote_pts v
    full outer join quest_pts qp on qp.voter_phone = v.voter_phone
  )
  select nm, st, votes, points from combined
  where points > 0 order by points desc limit p_limit;
$$;
grant execute on function public.top_supporters(uuid, int) to anon, authenticated, service_role;

-- participant_point_history
create or replace function public.participant_point_history(p_participant_id uuid)
returns table (day date, points bigint, cumulative bigint)
language sql stable security definer set search_path = public
as $$
  with vote_day as (
    select vote_date as day, coalesce(sum(points), 0) as pts
    from public.daily_votes where participant_id = p_participant_id
    group by vote_date
  ),
  quest_day as (
    select s.created_at::date as day, coalesce(sum(q.point), 0) as pts
    from public.submissions s join public.quests q on q.id = s.quest_id
    where s.participant_id = p_participant_id and s.status = 'approved'
    group by s.created_at::date
  ),
  merged as (
    select day, sum(pts) as points
    from (select day, pts from vote_day union all select day, pts from quest_day) u
    group by day
  )
  select day, points, sum(points) over (order by day) from merged order by day;
$$;
grant execute on function public.participant_point_history(uuid) to anon, authenticated, service_role;

-- top_voters
create or replace function public.top_voters(p_limit int default 5)
returns table (voter_name text, school_name text, votes bigint, quests bigint, score bigint)
language sql stable security definer set search_path = public
as $$
  with v as (
    select voter_phone, max(voter_name) as nm, max(voter_school) as school,
           count(*) as votes, coalesce(sum(points), 0) as pts
    from public.daily_votes where voter_phone is not null group by voter_phone
  ),
  q as (
    select s.voter_phone, max(s.voter_name) as nm,
           count(*) as quests, coalesce(sum(qu.point), 0) as quest_points
    from public.submissions s join public.quests qu on qu.id = s.quest_id
    where s.status = 'approved' and s.voter_phone is not null
    group by s.voter_phone
  )
  select coalesce(v.nm, q.nm, v.voter_phone, q.voter_phone),
         coalesce(v.school, ''),
         coalesce(v.votes, 0),
         coalesce(q.quests, 0),
         (coalesce(v.pts, 0) + coalesce(q.quest_points, 0))
  from v full outer join q on q.voter_phone = v.voter_phone
  where (coalesce(v.votes, 0) > 0 or coalesce(q.quests, 0) > 0)
  order by 5 desc limit p_limit;
$$;
grant execute on function public.top_voters(int) to anon, authenticated, service_role;

-- voter_distribution
create or replace function public.voter_distribution(p_phone text)
returns table (
  participant_id uuid, participant_name text, school_name text,
  votes bigint, quests bigint, points bigint
)
language sql stable security definer set search_path = public
as $$
  with v as (
    select participant_id, count(*) as votes, coalesce(sum(points), 0) as pts
    from public.daily_votes where voter_phone = p_phone group by participant_id
  ),
  q as (
    select s.participant_id, count(*) as quests, coalesce(sum(qu.point), 0) as pts
    from public.submissions s join public.quests qu on qu.id = s.quest_id
    where s.status = 'approved' and s.voter_phone = p_phone
    group by s.participant_id
  ),
  ids as (select participant_id from v union select participant_id from q)
  select i.participant_id, p.name, sch.name,
         coalesce(v.votes, 0), coalesce(q.quests, 0),
         coalesce(v.pts, 0) + coalesce(q.pts, 0)
  from ids i
  join public.participants p on p.id = i.participant_id
  left join public.schools sch on sch.id = p.school_id
  left join v on v.participant_id = i.participant_id
  left join q on q.participant_id = i.participant_id
  order by 6 desc;
$$;
grant execute on function public.voter_distribution(text) to authenticated, service_role;

-- participant_point_log (sumber bedakan +5 vs +20)
create or replace function public.participant_point_log(p_participant_id uuid)
returns table (
  kind text, source text, voter_name text, voter_phone text,
  points int, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select 'vote'::text,
         case when dv.vote_kind = 'fav20' then 'Vote Favorit (+20)' else 'Vote Harian (+5)' end,
         coalesce(dv.voter_name, dv.voter_phone), dv.voter_phone,
         dv.points, dv.created_at
  from public.daily_votes dv
  where dv.participant_id = p_participant_id
  union all
  select 'quest'::text, q.name,
         coalesce(s.voter_name, s.voter_phone), s.voter_phone,
         q.point, s.created_at
  from public.submissions s join public.quests q on q.id = s.quest_id
  where s.participant_id = p_participant_id and s.status = 'approved'
  order by created_at desc;
$$;
grant execute on function public.participant_point_log(uuid) to authenticated, service_role;

-- admin_voters (filter) — pts vote pakai sum(points)
drop function if exists public.admin_voters(uuid, date, date);
create or replace function public.admin_voters(
  p_participant_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns table (
  voter_phone text, voter_name text, voter_email text, voter_status text,
  voter_school text, voter_class text, votes bigint, quests bigint,
  points bigint, first_seen timestamptz, last_seen timestamptz
)
language sql stable security definer set search_path = public
as $$
  with v as (
    select voter_phone, max(voter_name) as nm, max(voter_email) as em,
           max(voter_status) as st, max(voter_school) as sch, max(voter_class) as cls,
           count(*) as votes, coalesce(sum(points), 0) as pts,
           min(created_at) as first_c, max(created_at) as last_c
    from public.daily_votes
    where voter_phone is not null
      and (p_participant_id is null or participant_id = p_participant_id)
      and (p_from is null or created_at::date >= p_from)
      and (p_to is null or created_at::date <= p_to)
    group by voter_phone
  ),
  q as (
    select s.voter_phone, max(s.voter_name) as nm, max(s.voter_email) as em,
           count(*) as quests, coalesce(sum(qu.point), 0) as pts,
           min(s.created_at) as first_c, max(s.created_at) as last_c
    from public.submissions s join public.quests qu on qu.id = s.quest_id
    where s.status = 'approved' and s.voter_phone is not null
      and (p_participant_id is null or s.participant_id = p_participant_id)
      and (p_from is null or s.created_at::date >= p_from)
      and (p_to is null or s.created_at::date <= p_to)
    group by s.voter_phone
  )
  select coalesce(v.voter_phone, q.voter_phone),
         coalesce(v.nm, q.nm, v.voter_phone, q.voter_phone),
         coalesce(v.em, q.em), v.st, v.sch, v.cls,
         coalesce(v.votes, 0), coalesce(q.quests, 0),
         coalesce(v.pts, 0) + coalesce(q.pts, 0),
         least(v.first_c, q.first_c), greatest(v.last_c, q.last_c)
  from v full outer join q on q.voter_phone = v.voter_phone
  order by first_seen desc nulls last;
$$;
grant execute on function public.admin_voters(uuid, date, date) to authenticated, service_role;
