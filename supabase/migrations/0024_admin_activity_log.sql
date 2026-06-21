-- =====================================================================
-- Migration 0024 — admin_activity_log (+count)
--   Feed gabungan: vote harian (+5), vote favorit (+20), dan quest.
--   Filter: jenis, peserta, rentang tanggal, cari voter, status (quest).
--   Paginasi server (limit/offset). Terbaru di atas.
--
--   p_kind: 'all' | 'daily5' | 'fav20' | 'quest'
--   p_qstatus: '' | 'pending' | 'approved' | 'rejected'  (khusus quest)
-- =====================================================================

create or replace function public.admin_activity_log(
  p_kind           text default 'all',
  p_participant_id uuid default null,
  p_from           date default null,
  p_to             date default null,
  p_search         text default null,
  p_qstatus        text default null,
  p_limit          int  default 30,
  p_offset         int  default 0
)
returns table (
  kind             text,        -- 'daily5' | 'fav20' | 'quest'
  source           text,        -- label jenis / nama quest
  voter_name       text,
  voter_phone      text,
  participant_name text,
  points           int,
  status           text,        -- 'approved' (vote) / status submission
  created_at       timestamptz
)
language sql stable security definer set search_path = public
as $$
  with rows as (
    -- Votes (daily5 / fav20)
    select dv.vote_kind as kind,
           case when dv.vote_kind = 'fav20' then 'Vote Favorit (+20)'
                else 'Vote Harian (+5)' end as source,
           dv.voter_name, dv.voter_phone,
           p.name as participant_name,
           dv.points, 'approved'::text as status, dv.created_at
    from public.daily_votes dv
    join public.participants p on p.id = dv.participant_id
    where (p_kind = 'all' or p_kind = dv.vote_kind)
      and (p_qstatus is null or p_qstatus = '')   -- status filter = quest only
      and (p_participant_id is null or dv.participant_id = p_participant_id)
      and (p_from is null or dv.created_at::date >= p_from)
      and (p_to   is null or dv.created_at::date <= p_to)
      and (
        p_search is null or p_search = ''
        or dv.voter_name ilike '%' || p_search || '%'
        or dv.voter_phone like '%' || p_search || '%'
      )

    union all

    -- Quest submissions
    select 'quest' as kind, q.name as source,
           s.voter_name, s.voter_phone,
           p.name as participant_name,
           q.point as points, s.status, s.created_at
    from public.submissions s
    join public.quests q on q.id = s.quest_id
    join public.participants p on p.id = s.participant_id
    where (p_kind = 'all' or p_kind = 'quest')
      and (p_participant_id is null or s.participant_id = p_participant_id)
      and (p_qstatus is null or p_qstatus = '' or s.status = p_qstatus)
      and (p_from is null or s.created_at::date >= p_from)
      and (p_to   is null or s.created_at::date <= p_to)
      and (
        p_search is null or p_search = ''
        or s.voter_name ilike '%' || p_search || '%'
        or s.voter_phone like '%' || p_search || '%'
      )
  )
  select * from rows
  order by created_at desc
  limit p_limit offset p_offset;
$$;
grant execute on function
  public.admin_activity_log(text, uuid, date, date, text, text, int, int)
  to authenticated, service_role;

create or replace function public.admin_activity_log_count(
  p_kind           text default 'all',
  p_participant_id uuid default null,
  p_from           date default null,
  p_to             date default null,
  p_search         text default null,
  p_qstatus        text default null
)
returns bigint
language sql stable security definer set search_path = public
as $$
  select
    (case when (p_kind in ('all','daily5','fav20')) and (p_qstatus is null or p_qstatus = '')
       then (
         select count(*) from public.daily_votes dv
         where (p_kind = 'all' or p_kind = dv.vote_kind)
           and (p_participant_id is null or dv.participant_id = p_participant_id)
           and (p_from is null or dv.created_at::date >= p_from)
           and (p_to   is null or dv.created_at::date <= p_to)
           and (p_search is null or p_search = ''
                or dv.voter_name ilike '%' || p_search || '%'
                or dv.voter_phone like '%' || p_search || '%')
       )
       else 0 end)
    +
    (case when (p_kind in ('all','quest'))
       then (
         select count(*) from public.submissions s
         where (p_participant_id is null or s.participant_id = p_participant_id)
           and (p_qstatus is null or p_qstatus = '' or s.status = p_qstatus)
           and (p_from is null or s.created_at::date >= p_from)
           and (p_to   is null or s.created_at::date <= p_to)
           and (p_search is null or p_search = ''
                or s.voter_name ilike '%' || p_search || '%'
                or s.voter_phone like '%' || p_search || '%')
       )
       else 0 end);
$$;
grant execute on function
  public.admin_activity_log_count(text, uuid, date, date, text, text)
  to authenticated, service_role;
