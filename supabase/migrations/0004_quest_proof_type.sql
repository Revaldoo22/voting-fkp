-- =====================================================================
-- Migration 0004 — quest proof type (link vs file upload)
-- =====================================================================

alter table public.quests
  add column if not exists proof_type text not null default 'file'
    check (proof_type in ('link', 'file'));

-- 'link'  -> voter submits a URL to a post (video / poster)
-- 'file'  -> voter uploads a screenshot (follow proof)
