-- =====================================================================
-- Migration 0006
--   * quest attachment (reference link + reference image)
--   * fix top_supporters: include approved quest points, not just votes
-- =====================================================================

-- ---- Quest reference attachments ------------------------------------
alter table public.quests
  add column if not exists ref_link  text,
  add column if not exists ref_image text;

-- ref_link  -> e.g. the social media account to follow / reference post
-- ref_image -> e.g. a poster reference image (Storage public URL)

-- ---------------------------------------------------------------------
-- top_supporters(participant) — total contribution per voter to a
-- participant = daily votes (×5) + approved quest points submitted by
-- that voter FOR that participant.
-- ---------------------------------------------------------------------
create or replace function public.top_supporters(p_participant_id uuid, p_limit int default 5)
returns table (voter_name text, votes bigint, points bigint)
language sql
stable
security definer
set search_path = public
as $$
  with vote_pts as (
    select user_id, count(*) as votes, count(*) * 5 as pts
    from public.daily_votes
    where participant_id = p_participant_id
    group by user_id
  ),
  quest_pts as (
    select s.user_id, coalesce(sum(q.point), 0) as pts
    from public.submissions s
    join public.quests q on q.id = s.quest_id
    where s.participant_id = p_participant_id
      and s.status = 'approved'
    group by s.user_id
  ),
  combined as (
    select
      coalesce(v.user_id, qp.user_id) as user_id,
      coalesce(v.votes, 0)            as votes,
      coalesce(v.pts, 0) + coalesce(qp.pts, 0) as points
    from vote_pts v
    full outer join quest_pts qp on qp.user_id = v.user_id
  )
  select p.name as voter_name, c.votes, c.points
  from combined c
  join public.profiles p on p.id = c.user_id
  where c.points > 0
  order by c.points desc
  limit p_limit;
$$;

grant execute on function public.top_supporters(uuid, int) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- participant_point_history(participant) — daily cumulative points,
-- now counting BOTH daily votes (×5) and approved quest points
-- (attributed to the submission's created day).
-- ---------------------------------------------------------------------
create or replace function public.participant_point_history(p_participant_id uuid)
returns table (day date, points bigint, cumulative bigint)
language sql
stable
security definer
set search_path = public
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
    select day, sum(pts) as points from (
      select day, pts from vote_day
      union all
      select day, pts from quest_day
    ) u
    group by day
  )
  select day,
         points,
         sum(points) over (order by day) as cumulative
  from merged
  order by day;
$$;

grant execute on function public.participant_point_history(uuid) to authenticated, service_role;

-- ---- Storage: allow any authenticated user to upload participant photos --
-- (participants update their own photo; admin uploads on create). The write
-- to the participants table itself is still guarded (admin RLS or the
-- /api/participant/photo route restricted to the owner).
drop policy if exists storage_photos_admin_write on storage.objects;
drop policy if exists storage_photos_auth_write on storage.objects;
create policy storage_photos_auth_write on storage.objects
  for insert with check (
    bucket_id = 'participant-photos' and auth.uid() is not null
  );
