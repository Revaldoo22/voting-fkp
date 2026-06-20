-- =====================================================================
-- Migration 0013 — Fix supporter/top-voter name resolution
-- A supporter who only did quests (no daily votes) showed their phone
-- number instead of name, because the name was read only from daily_votes.
-- Now resolve the display name from votes OR submissions.
-- =====================================================================

create or replace function public.top_supporters(p_participant_id uuid, p_limit int default 5)
returns table (voter_name text, votes bigint, points bigint)
language sql stable security definer set search_path = public
as $$
  with vote_pts as (
    select voter_phone, max(voter_name) as nm, count(*) as votes, count(*) * 5 as pts
    from public.daily_votes
    where participant_id = p_participant_id and voter_phone is not null
    group by voter_phone
  ),
  quest_pts as (
    select s.voter_phone, max(s.voter_name) as nm, coalesce(sum(q.point), 0) as pts
    from public.submissions s
    join public.quests q on q.id = s.quest_id
    where s.participant_id = p_participant_id and s.status = 'approved'
      and s.voter_phone is not null
    group by s.voter_phone
  ),
  combined as (
    select coalesce(v.voter_phone, qp.voter_phone)         as phone,
           coalesce(v.nm, qp.nm, v.voter_phone, qp.voter_phone) as nm,
           coalesce(v.votes, 0)                            as votes,
           coalesce(v.pts, 0) + coalesce(qp.pts, 0)        as points
    from vote_pts v
    full outer join quest_pts qp on qp.voter_phone = v.voter_phone
  )
  select nm as voter_name, votes, points
  from combined
  where points > 0
  order by points desc
  limit p_limit;
$$;
grant execute on function public.top_supporters(uuid, int) to anon, authenticated, service_role;

create or replace function public.top_voters(p_limit int default 5)
returns table (voter_name text, school_name text, votes bigint, quests bigint, score bigint)
language sql stable security definer set search_path = public
as $$
  with v as (
    select voter_phone, max(voter_name) as nm, max(voter_school) as school, count(*) as votes
    from public.daily_votes where voter_phone is not null group by voter_phone
  ),
  q as (
    select s.voter_phone, max(s.voter_name) as nm,
           count(*) as quests, coalesce(sum(qu.point), 0) as quest_points
    from public.submissions s
    join public.quests qu on qu.id = s.quest_id
    where s.status = 'approved' and s.voter_phone is not null
    group by s.voter_phone
  )
  select coalesce(v.nm, q.nm, v.voter_phone, q.voter_phone) as voter_name,
         coalesce(v.school, '')                             as school_name,
         coalesce(v.votes, 0)                               as votes,
         coalesce(q.quests, 0)                              as quests,
         (coalesce(v.votes, 0) * 5 + coalesce(q.quest_points, 0)) as score
  from v
  full outer join q on q.voter_phone = v.voter_phone
  where (coalesce(v.votes, 0) > 0 or coalesce(q.quests, 0) > 0)
  order by score desc
  limit p_limit;
$$;
grant execute on function public.top_voters(int) to anon, authenticated, service_role;
