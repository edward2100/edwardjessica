import { useEffect, useState } from "react";
import { getRsvpWindow, isRsvpClosed } from "@/lib/rsvp";
import type { RsvpWindow, WeddingContent } from "@/lib/types";

// setTimeout fires immediately for delays above 2^31-1 ms (~24.8 days), so
// longer waits are done in steps.
const MAX_TIMER_MS = 2_147_483_647;

/**
 * CL-5: whether RSVP is closed for this deadline (same rule as isRsvpClosed),
 * re-evaluated when the deadline passes while the page stays open: on a timer
 * at the deadline, and when the tab regains focus (a device that slept past
 * the deadline). Pages use it for the whole RSVP section, so the closed card,
 * countdown, floating button and contact links switch together.
 */
export function useRsvpClosed(deadlineIso: string) {
  // Bumped to re-render (and re-check) once the deadline has passed.
  const [tick, setTick] = useState(0);
  const closed = isRsvpClosed(deadlineIso);

  useEffect(() => {
    if (closed) return;
    const msLeft = new Date(deadlineIso).getTime() - Date.now();
    if (!Number.isFinite(msLeft)) return;
    const timer = window.setTimeout(
      () => setTick((current) => current + 1),
      Math.min(Math.max(msLeft, 0) + 1, MAX_TIMER_MS),
    );
    function recheck() {
      if (isRsvpClosed(deadlineIso)) setTick((current) => current + 1);
    }
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [closed, deadlineIso, tick]);

  return closed;
}

/**
 * LR-4: the guest's RSVP window (getRsvpWindow), live like useRsvpClosed: one
 * clock for the deadline (open -> late/closed) and one for the end of the
 * late window (late -> closed). No end date, or late RSVPs off, = no second
 * timer. Rendered with the same clock rule as useRsvpClosed, so the server
 * HTML and hydration agree.
 */
export function useRsvpWindow(
  deadlineIso: string,
  content: Pick<WeddingContent, "lateRsvp">,
): RsvpWindow {
  useRsvpClosed(deadlineIso);
  useRsvpClosed(
    content.lateRsvp?.enabled === true ? (content.lateRsvp.until ?? "") : "",
  );
  return getRsvpWindow(deadlineIso, content);
}
