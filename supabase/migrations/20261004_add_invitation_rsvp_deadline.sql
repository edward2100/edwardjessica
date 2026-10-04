-- Per-invitation RSVP deadline (personal extension / public-link snapshot).
-- NULL = use the published content.rsvpDeadline (the main deadline), so
-- existing invitations are unaffected.
--
-- Written when a guest self-registers through a public link that has its own
-- deadline (copied from the link at registration time), or when an admin sets
-- an override in Guests > Edit. Later edits to a link's deadline do NOT change
-- invitations that already registered.
--
-- Apply in the Supabase SQL editor BEFORE deploying the code that reads it.
-- The app only sends rsvp_deadline when there is a deadline to write (or an
-- override to clear), but deadline links and admin overrides need the column.
ALTER TABLE invitation_groups
  ADD COLUMN IF NOT EXISTS rsvp_deadline timestamptz;
