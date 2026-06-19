-- =====================================================================
-- Migration 0005 — quest frequency (once vs daily) + submission guard
-- =====================================================================

alter table public.quests
  add column if not exists frequency text not null default 'once'
    check (frequency in ('once', 'daily'));

-- 'once'  -> a voter can complete this quest for a participant a single time
-- 'daily' -> a voter can complete it once per day per participant

-- Track the submission day so daily quests can be limited per calendar day.
alter table public.submissions
  add column if not exists submit_date date not null default current_date;

-- ---------------------------------------------------------------------
-- Guard inserts at the DB level so the rule holds regardless of client.
--   once  : block if a non-rejected submission already exists for
--           (user, quest, participant).
--   daily : block if a non-rejected submission already exists for
--           (user, quest, participant, today).
-- Rejected submissions don't count, so a voter may retry after a reject.
-- ---------------------------------------------------------------------
create or replace function public.check_submission_allowed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_freq text;
begin
  select frequency into v_freq from public.quests where id = new.quest_id;

  if v_freq = 'daily' then
    if exists (
      select 1 from public.submissions
      where user_id = new.user_id
        and quest_id = new.quest_id
        and participant_id = new.participant_id
        and submit_date = current_date
        and status <> 'rejected'
    ) then
      raise exception 'DAILY_DONE';
    end if;
  else
    if exists (
      select 1 from public.submissions
      where user_id = new.user_id
        and quest_id = new.quest_id
        and participant_id = new.participant_id
        and status <> 'rejected'
    ) then
      raise exception 'ALREADY_DONE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_submission_allowed on public.submissions;
create trigger trg_check_submission_allowed
  before insert on public.submissions
  for each row execute function public.check_submission_allowed();
