-- =====================================================================
-- Migration 0021 — participant_supporter_count
--   Jumlah pendukung sebenarnya (distinct nomor WA) untuk satu peserta,
--   gabungan vote + quest approved. Dashboard pakai ini, bukan length
--   dari top_supporters (yang dibatasi limit).
-- =====================================================================

create or replace function public.participant_supporter_count(p_participant_id uuid)
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*) from (
    select voter_phone from public.daily_votes
    where participant_id = p_participant_id and voter_phone is not null
    union
    select voter_phone from public.submissions
    where participant_id = p_participant_id and status = 'approved'
      and voter_phone is not null
  ) u;
$$;
grant execute on function public.participant_supporter_count(uuid)
  to anon, authenticated, service_role;
