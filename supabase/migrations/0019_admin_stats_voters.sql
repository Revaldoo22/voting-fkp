-- =====================================================================
-- Migration 0019 — admin_stats total_voters by distinct WhatsApp number
-- Voters are anonymous now (no 'voter' profiles), so count distinct
-- voter_phone across daily_votes + submissions.
-- =====================================================================

create or replace function public.admin_stats()
returns table (
  total_schools      bigint,
  total_participants bigint,
  total_voters       bigint,
  total_votes        bigint,
  total_points       bigint
)
language sql stable security definer set search_path = public
as $$
  select
    (select count(*) from public.schools),
    (select count(*) from public.participants),
    (select count(*) from (
        select voter_phone from public.daily_votes where voter_phone is not null
        union
        select voter_phone from public.submissions
          where voter_phone is not null and status = 'approved'
     ) u),
    (select count(*) from public.daily_votes),
    (select coalesce(sum(total_points), 0) from public.participants);
$$;

grant execute on function public.admin_stats() to authenticated, service_role;
