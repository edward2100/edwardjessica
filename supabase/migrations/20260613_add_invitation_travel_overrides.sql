-- Per-invitation travel overrides for custom (admin-created) overseas links.
-- A single JSONB column holds all override toggles so future additions need
-- no further migration. NULL/absent keys mean "use the flow's default
-- behavior", so existing invitations are unaffected.
--
-- Shape (all keys optional):
--   {
--     "requireGuestNames":    boolean,  -- false => guest picks a headcount, no names
--     "transportProvided":    boolean,  -- show/hide the airport transport offer
--     "accommodationProvided":boolean,  -- show/hide the provided-room offer
--     "checkInDate":          "YYYY-MM-DD",
--     "checkOutDate":         "YYYY-MM-DD"
--   }
ALTER TABLE invitation_groups
  ADD COLUMN IF NOT EXISTS travel_overrides jsonb;
