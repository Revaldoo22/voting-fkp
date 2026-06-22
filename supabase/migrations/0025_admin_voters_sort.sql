-- =====================================================================
-- Migration 0025 — admin_voters: param p_sort
--   p_sort: 'recent' (default, bergabung terbaru) | 'points_desc' | 'points_asc'
-- =====================================================================

drop function if exists public.admin_voters(uuid, date, date, text, text, text, int, int);

create or replace function public.admin_voters(
  p_participant_id uuid  default null,
  p_from           date  default null,
  p_to             date  default null,
  p_search         text  default null,
  p_status         text  default null,
  p_school         text  default null,
  p_limit          int   default 25,
  p_offset         int   default 0,
  p_sort           text  default 'recent'
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
  ),
  merged as (
    select coalesce(v.voter_phone, q.voter_phone)             as voter_phone,
           coalesce(v.nm, q.nm, v.voter_phone, q.voter_phone) as voter_name,
           coalesce(v.em, q.em)                               as voter_email,
           v.st as voter_status, v.sch as voter_school, v.cls as voter_class,
           coalesce(v.votes, 0) as votes, coalesce(q.quests, 0) as quests,
           coalesce(v.pts, 0) + coalesce(q.pts, 0) as points,
           least(v.first_c, q.first_c) as first_seen,
           greatest(v.last_c, q.last_c) as last_seen
    from v full outer join q on q.voter_phone = v.voter_phone
  )
  select voter_phone, voter_name, voter_email, voter_status, voter_school,
         voter_class, votes, quests, points, first_seen, last_seen
  from merged
  where (p_status is null or p_status = '' or voter_status = p_status)
    and (p_school is null or p_school = '' or voter_school = p_school)
    and (
      p_search is null or p_search = ''
      or voter_name  ilike '%' || p_search || '%'
      or voter_phone like  '%' || p_search || '%'
      or voter_email ilike '%' || p_search || '%'
    )
  order by
    case when p_sort = 'points_desc' then points end desc nulls last,
    case when p_sort = 'points_asc'  then points end asc  nulls last,
    case when p_sort not in ('points_desc','points_asc') then first_seen end desc nulls last
  limit p_limit offset p_offset;
$$;
grant execute on function
  public.admin_voters(uuid, date, date, text, text, text, int, int, text)
  to authenticated, service_role;
