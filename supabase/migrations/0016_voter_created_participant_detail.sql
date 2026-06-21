-- =====================================================================
-- Migration 0016
--   * admin_voters(): tambah first_vote / last_activity timestamps
--   * participant_supporters_detail(participant_id): daftar pendukung
--     satu peserta — siapa, kapan, berapa poin, vote & quest.
-- =====================================================================

drop function if exists public.admin_voters();
create or replace function public.admin_voters()
returns table (
  voter_phone   text,
  voter_name    text,
  voter_email   text,
  voter_status  text,
  voter_school  text,
  voter_class   text,
  votes         bigint,
  quests        bigint,
  points        bigint,
  first_seen    timestamptz,
  last_seen     timestamptz
)
language sql stable security definer set search_path = public
as $$
  with v as (
    select voter_phone,
           max(voter_name)   as nm,
           max(voter_email)  as em,
           max(voter_status) as st,
           max(voter_school) as sch,
           max(voter_class)  as cls,
           count(*)          as votes,
           count(*) * 5      as pts,
           min(created_at)   as first_c,
           max(created_at)   as last_c
    from public.daily_votes
    where voter_phone is not null
    group by voter_phone
  ),
  q as (
    select s.voter_phone,
           max(s.voter_name)  as nm,
           max(s.voter_email) as em,
           count(*)           as quests,
           coalesce(sum(qu.point), 0) as pts,
           min(s.created_at)  as first_c,
           max(s.created_at)  as last_c
    from public.submissions s
    join public.quests qu on qu.id = s.quest_id
    where s.status = 'approved' and s.voter_phone is not null
    group by s.voter_phone
  )
  select
    coalesce(v.voter_phone, q.voter_phone)             as voter_phone,
    coalesce(v.nm, q.nm, v.voter_phone, q.voter_phone) as voter_name,
    coalesce(v.em, q.em)                               as voter_email,
    v.st                                               as voter_status,
    v.sch                                              as voter_school,
    v.cls                                              as voter_class,
    coalesce(v.votes, 0)                               as votes,
    coalesce(q.quests, 0)                              as quests,
    coalesce(v.pts, 0) + coalesce(q.pts, 0)            as points,
    least(v.first_c, q.first_c)                        as first_seen,
    greatest(v.last_c, q.last_c)                       as last_seen
  from v
  full outer join q on q.voter_phone = v.voter_phone
  order by points desc;
$$;
grant execute on function public.admin_voters() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- participant_supporters_detail(p_participant_id)
-- Pendukung satu peserta: per nomor WA — nama, kontak, jumlah vote &
-- quest, total poin, kapan pertama & terakhir mendukung.
-- ---------------------------------------------------------------------
create or replace function public.participant_supporters_detail(p_participant_id uuid)
returns table (
  voter_phone  text,
  voter_name   text,
  voter_email  text,
  voter_status text,
  voter_school text,
  voter_class  text,
  votes        bigint,
  quests       bigint,
  points       bigint,
  first_seen   timestamptz,
  last_seen    timestamptz
)
language sql stable security definer set search_path = public
as $$
  with v as (
    select voter_phone,
           max(voter_name)   as nm,
           max(voter_email)  as em,
           max(voter_status) as st,
           max(voter_school) as sch,
           max(voter_class)  as cls,
           count(*)          as votes,
           count(*) * 5      as pts,
           min(created_at)   as first_c,
           max(created_at)   as last_c
    from public.daily_votes
    where participant_id = p_participant_id and voter_phone is not null
    group by voter_phone
  ),
  q as (
    select s.voter_phone,
           max(s.voter_name)  as nm,
           max(s.voter_email) as em,
           count(*)           as quests,
           coalesce(sum(qu.point), 0) as pts,
           min(s.created_at)  as first_c,
           max(s.created_at)  as last_c
    from public.submissions s
    join public.quests qu on qu.id = s.quest_id
    where s.participant_id = p_participant_id and s.status = 'approved'
      and s.voter_phone is not null
    group by s.voter_phone
  )
  select
    coalesce(v.voter_phone, q.voter_phone)             as voter_phone,
    coalesce(v.nm, q.nm, v.voter_phone, q.voter_phone) as voter_name,
    coalesce(v.em, q.em)                               as voter_email,
    v.st                                               as voter_status,
    v.sch                                              as voter_school,
    v.cls                                              as voter_class,
    coalesce(v.votes, 0)                               as votes,
    coalesce(q.quests, 0)                              as quests,
    coalesce(v.pts, 0) + coalesce(q.pts, 0)            as points,
    least(v.first_c, q.first_c)                        as first_seen,
    greatest(v.last_c, q.last_c)                       as last_seen
  from v
  full outer join q on q.voter_phone = v.voter_phone
  order by points desc;
$$;
grant execute on function public.participant_supporters_detail(uuid) to authenticated, service_role;
