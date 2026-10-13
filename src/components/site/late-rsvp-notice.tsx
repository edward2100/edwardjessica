import { Clock } from "lucide-react";
import { copy } from "@/lib/i18n";
import { formatRsvpDeadlineDate } from "@/lib/rsvp";
import type { Language } from "@/lib/types";

/**
 * LR-4: note at the top of a late RSVP form: "Late RSVP · Our RSVP date was
 * 12 October 2026. We'll confirm your place with you." Guests who already
 * answered get "Late change · … We'll confirm the change with you."
 */
export function LateRsvpNotice({
  change = false,
  deadlineIso,
  language,
  timeZone,
}: {
  change?: boolean;
  /** The guest's effective RSVP deadline (already passed). */
  deadlineIso: string;
  language: Language;
  timeZone?: string;
}) {
  const c = copy[language];
  return (
    <p className="late-rsvp-notice">
      <Clock size={16} aria-hidden="true" />
      <span>
        <strong>{change ? c.lateChangeLabel : c.lateRsvpLabel}</strong>
        {" · "}
        {(change ? c.lateChangeNotice : c.lateRsvpNotice).replace(
          "{date}",
          formatRsvpDeadlineDate(deadlineIso, timeZone, language),
        )}
      </span>
    </p>
  );
}
