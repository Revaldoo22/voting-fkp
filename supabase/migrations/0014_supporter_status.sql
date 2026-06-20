-- =====================================================================
-- Migration 0014 — top_supporters returns voter_status (name + status)
-- One phone = one fixed identity, so status is just max(voter_status).
-- =====================================================================

drop function if exists public.top_supporters(uuid, int);

create or replace function public.top_supporters(p_participant_id uuid, p_limit int default 5)
returns table (voter_name text, voter_status text, votes bigint, points bigint)
language sql stable security definer set search_path = public
as $$
  with vote_pts as (
    select voter_phone, max(voter_name) as nm, max(voter_status) as st,
           count(*) as votes, count(*) * 5 as pts
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
  select nm as voter_name, st as voter_status, votes, points
  from combined
  where points > 0
  order by points desc
  limit p_limit;
$$;
grant execute on function public.top_supporters(uuid, int) to anon, authenticated, service_role;
