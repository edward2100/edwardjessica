-- Migration: audit fixes 2026-06-11
-- Apply order: after 20260610_add_admin_message_logs.sql
-- Apply with: supabase db push  OR  psql $DATABASE_URL -f supabase/migrations/20260611_audit_fixes.sql

-- ============================================================
-- G2: Fix eligible_events column default
-- Rationale (per Edward): generic public guests (e.g. JESSMARRIED) are eligible
-- for all three events. Align the DB default with the application logic.
-- NOTE: existing rows are NOT changed — each invitation keeps its own explicit
-- eligible_events value. Only newly-inserted rows without an explicit value change.
-- ============================================================
alter table invitation_groups
  alter column eligible_events set default array['holy_matrimony','tea_lunch','dinner'];


-- ============================================================
-- G3: Replace get_invitation_by_code RPC — strip PII
-- email, phone, private_notes are server-side-only fields that must not be
-- returned by the public-facing RPC. The application reads invitation_groups
-- directly via the service-role key; this function is the unauthenticated surface.
-- ============================================================
create or replace function public.get_invitation_by_code(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'group', jsonb_build_object(
      'id',              ig.id,
      'code',            ig.code,
      'greeting',        ig.greeting,
      'group_name',      ig.group_name,
      'max_guests',      ig.max_guests,
      'side',            ig.side,
      'source',          ig.source,
      'flow',            ig.flow,
      'eligible_events', ig.eligible_events,
      'opened_at',       ig.opened_at,
      'created_at',      ig.created_at,
      'updated_at',      ig.updated_at
      -- email, phone, private_notes intentionally omitted
    ),
    'guests', coalesce(jsonb_agg(distinct to_jsonb(g)) filter (where g.id is not null), '[]'::jsonb),
    'rsvp', to_jsonb(r)
  )
  into result
  from invitation_groups ig
  left join guests g on g.invitation_group_id = ig.id
  left join rsvps r on r.invitation_group_id = ig.id
  where ig.code = upper(invite_code)
  group by ig.id, r.id;

  return result;
end;
$$;


-- ============================================================
-- G4: Duplicate self-registration prevention
-- Step 1: Normalise existing emails so the unique index is consistent.
-- Step 2: Show any conflicting duplicates (the index creation below will
--         FAIL if any exist — Edward must resolve them in the admin UI first).
-- Step 3: Create the partial unique index.
-- ============================================================

-- Step 1: normalise
update invitation_groups
set email = lower(trim(email))
where email is not null
  and email != lower(trim(email));

-- Step 2: review conflicts before applying Step 3.
-- Run this SELECT manually to check for duplicates; if it returns rows,
-- resolve them in the admin dashboard before running Step 3.
/*
select lower(email) as normalised_email, flow, count(*) as cnt,
       array_agg(id) as ids
from invitation_groups
where source = 'generic'
  and email is not null
group by lower(email), flow
having count(*) > 1;
*/

-- Step 3: unique partial index — prevents duplicate self-registrations
-- per normalised email + flow for the generic (self-register) source.
-- FAILS if duplicates exist (see Step 2 query above).
create unique index if not exists invitation_groups_email_flow_self_idx
  on invitation_groups (lower(email), flow)
  where source = 'generic' and email is not null;


-- ============================================================
-- G5: Performance indexes for hot query paths
-- Postgres DESC ordering puts NULLs first by default.
-- We use NULLS LAST on created_at to match data-store ORDER BY behaviour.
-- Backfill NULL created_at values so they sort predictably.
-- ============================================================

-- Backfill any NULL opened_at rows on invite_open_events (data integrity, safe default)
-- Note: content_versions has no created_at column; updated_at is used instead.
-- invite_open_events.opened_at has NOT NULL + default now() so the backfill is a no-op
-- on well-formed data but is included for safety on any legacy rows.
update invite_open_events set opened_at = now() where opened_at is null;

-- content_versions: published-content lookup (status + recency)
-- Uses updated_at because content_versions has no created_at column.
create index if not exists content_versions_status_updated_at_idx
  on content_versions (status, updated_at desc nulls last);

-- invite_open_events: open-count stat by group
create index if not exists invite_open_events_invitation_group_id_idx
  on invite_open_events (invitation_group_id);

-- rsvps: fast lookup by invitation group
create index if not exists rsvps_invitation_group_id_idx
  on rsvps (invitation_group_id);
