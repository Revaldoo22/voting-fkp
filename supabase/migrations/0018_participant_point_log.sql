-- =====================================================================
-- Migration 0018 — participant_point_log
--   Rincian setiap poin yang masuk ke seorang peserta:
--   sumber (Vote harian / nama quest), voter, poin, tanggal.
--   Terbaru di atas. Vote harian = +5; quest = poin quest (approved).
-- =====================================================================

create or replace function public.participant_point_log(p_participant_id uuid)
returns table (
  kind        text,        -- 'vote' | 'quest'
  source      text,        -- 'Vote harian' atau nama quest
  voter_name  text,
  voter_phone text,
  points      int,
  created_at  timestamptz
)
language sql stable security definer set search_path = public
as $$
  select 'vote'::text, 'Vote harian'::text,
         coalesce(dv.voter_name, dv.voter_phone), dv.voter_phone,
         5, dv.created_at
  from public.daily_votes dv
  where dv.participant_id = p_participant_id

  union all

  select 'quest'::text, q.name,
         coalesce(s.voter_name, s.voter_phone), s.voter_phone,
         q.point, s.created_at
  from public.submissions s
  join public.quests q on q.id = s.quest_id
  where s.participant_id = p_participant_id and s.status = 'approved'

  order by created_at desc;
$$;
grant execute on function public.participant_point_log(uuid) to authenticated, service_role;
