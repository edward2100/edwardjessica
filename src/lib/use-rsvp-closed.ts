import { useEffect, useState } from "react";
import { isRsvpClosed } from "@/lib/rsvp";

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
