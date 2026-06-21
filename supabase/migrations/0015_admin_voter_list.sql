-- =====================================================================
-- Migration 0015 — Admin voter directory
--   admin_voters()            : daftar voter (by nomor WA) + total poin
--   voter_distribution(phone) : rincian poin voter ke tiap peserta
-- Voter dianggap unik per nomor WhatsApp.
-- =====================================================================

create or replace function public.admin_voters()
returns table (
  voter_phone  text,
  voter_name   text,
  voter_email  text,
  voter_status text,
  voter_school text,
  voter_class  text,
  votes        bigint,
  quests       bigint,
  points       bigint
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
           count(*) * 5      as pts
    from public.daily_votes
    where voter_phone is not null
    group by voter_phone
  ),
  q as (
    select s.voter_phone,
           max(s.voter_name)  as nm,
           max(s.voter_email) as em,
           count(*)           as quests,
           coalesce(sum(qu.point), 0) as pts
    from public.submissions s
    join public.quests qu on qu.id = s.quest_id
    where s.status = 'approved' and s.voter_phone is not null
    group by s.voter_phone
  )
  select
    coalesce(v.voter_phone, q.voter_phone)        as voter_phone,
    coalesce(v.nm, q.nm, v.voter_phone, q.voter_phone) as voter_name,
    coalesce(v.em, q.em)                          as voter_email,
    v.st                                          as voter_status,
    v.sch                                         as voter_school,
    v.cls                                         as voter_class,
    coalesce(v.votes, 0)                          as votes,
    coalesce(q.quests, 0)                         as quests,
    coalesce(v.pts, 0) + coalesce(q.pts, 0)       as points
  from v
  full outer join q on q.voter_phone = v.voter_phone
  order by points desc;
$$;
grant execute on function public.admin_voters() to authenticated, service_role;

-- Per-participant point distribution for one voter (by phone).
create or replace function public.voter_distribution(p_phone text)
returns table (
  participant_id   uuid,
  participant_name text,
  school_name      text,
  votes            bigint,
  quests           bigint,
  points           bigint
)
language sql stable security definer set search_path = public
as $$
  with v as (
    select participant_id, count(*) as votes, count(*) * 5 as pts
    from public.daily_votes
    where voter_phone = p_phone
    group by participant_id
  ),
  q as (
    select s.participant_id, count(*) as quests, coalesce(sum(qu.point), 0) as pts
    from public.submissions s
    join public.quests qu on qu.id = s.quest_id
    where s.status = 'approved' and s.voter_phone = p_phone
    group by s.participant_id
  ),
  ids as (
    select participant_id from v
    union
    select participant_id from q
  )
  select
    i.participant_id,
    p.name                                   as participant_name,
    sch.name                                 as school_name,
    coalesce(v.votes, 0)                     as votes,
    coalesce(q.quests, 0)                    as quests,
    coalesce(v.pts, 0) + coalesce(q.pts, 0)  as points
  from ids i
  join public.participants p on p.id = i.participant_id
  left join public.schools sch on sch.id = p.school_id
  left join v on v.participant_id = i.participant_id
  left join q on q.participant_id = i.participant_id
  order by points desc;
$$;
grant execute on function public.voter_distribution(text) to authenticated, service_role;
