"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { LanguageToggle } from "@/components/site/language-toggle";
import type { Language } from "@/lib/types";

const OPENED_KEY = "ej-invite-opened";
// PL-6: the page a guest left by one of the site's own links (menu, Discover
// Medan, travel). Coming straight back to it skips its cover once.
const RETURN_KEY = "ej-invite-return";

/**
 * Labels the cover needs. The invite pages pass the whole `copy[language]`
 * object (it has these keys plus many more); we accept a structural subset so
 * either the full copy object or a trimmed one satisfies the type.
 */
export type OpeningCoverLabels = {
  tapToOpen: string;
  tapTakeLetter: string;
  tapUnfold: string;
  weddingOf: string;
  /** PL-6: "Dear" / "Kepada Yth." above a personal link's guest name. */
  coverGreeting: string;
};

function hasBeenOpened(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // ?replay forces the cover to show again (testing/previewing).
    if (new URLSearchParams(window.location.search).has("replay")) return false;
    return window.sessionStorage.getItem(OPENED_KEY) === "1";
  } catch {
    return false;
  }
}

function markOpened() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(OPENED_KEY, "1");
  } catch {
    // Session storage may be blocked; the cover still works for this view.
  }
}

// PL-6: a personal link's cover shows on every visit, refreshes included;
// only coming back from one of the site's own pages skips it.
function isReturnVisit(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("replay")) return false;
    return window.sessionStorage.getItem(RETURN_KEY) === window.location.pathname;
  } catch {
    return false;
  }
}

function clearReturnVisit() {
  try {
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

/**
 * PL-6: notes when the guest follows one of the site's own links away from
 * this page, so the cover is skipped once when they come back to it.
 */
export function useCoverReturnMarker(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function remember(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname) return;
      try {
        window.sessionStorage.setItem(RETURN_KEY, window.location.pathname);
      } catch {
        // Storage blocked: the cover simply shows again on return.
      }
    }
    document.addEventListener("click", remember, true);
    return () => document.removeEventListener("click", remember, true);
  }, [enabled]);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// sessionStorage never notifies in-tab, so the store never re-subscribes;
// the snapshot only changes across mounts.
function noopSubscribe() {
  return () => {};
}

function neverOnServer() {
  return false;
}

export function OpeningCover({
  variant,
  coupleName,
  guestName,
  language,
  onLanguageChange,
  labels,
  onOpened,
  onFirstInteraction,
}: {
  variant: "moongate" | "envelope";
  coupleName: string;
  /**
   * PL-6: a personal link's guest ("Bp. Hadi & Istri"), shown on the cover.
   * Their cover shows on every visit (see isReturnVisit).
   */
  guestName?: string;
  language: Language;
  onLanguageChange: (language: Language) => void;
  labels: OpeningCoverLabels;
  onOpened: () => void;
  onFirstInteraction: () => void;
}) {
  // Skip the cover if this session already opened the invitation.
  // useSyncExternalStore keeps the sessionStorage read hydration-safe: the
  // server snapshot renders the cover, and the client re-renders without it
  // immediately after hydration (one-frame flash on repeat visits).
  const skip = useSyncExternalStore(
    noopSubscribe,
    guestName ? isReturnVisit : hasBeenOpened,
    neverOnServer,
  );
  const guest = guestName
    ? { label: labels.coverGreeting, name: guestName }
    : undefined;
  const [mounted, setMounted] = useState(true);
  const interactedRef = useRef(false);
  const skipUnlockedRef = useRef(false);

  const handleFirstInteraction = useCallback(() => {
    if (interactedRef.current) return;
    interactedRef.current = true;
    onFirstInteraction();
  }, [onFirstInteraction]);

  const finish = useCallback(() => {
    markOpened();
    onOpened();
    setMounted(false);
  }, [onOpened]);

  // When skipping, the page must still unlock — once.
  useEffect(() => {
    if (skip && !skipUnlockedRef.current) {
      skipUnlockedRef.current = true;
      // PL-6: a return visit skips the cover once; a refresh shows it again.
      if (guestName) clearReturnVisit();
      onOpened();
    }
  }, [skip, onOpened, guestName]);

  if (skip || !mounted) return null;

  return (
    <div
      className={`opening-cover${variant === "moongate" ? " is-moongate" : ""}`}
      role="dialog"
      aria-modal="true"
    >
      {variant === "envelope" ? (
        <div className="opening-cover-lang">
          <LanguageToggle language={language} onChange={onLanguageChange} />
        </div>
      ) : null}
      {variant === "moongate" ? (
        <MoongateCover
          guest={guest}
          labels={labels}
          onFirstInteraction={handleFirstInteraction}
          onFinish={finish}
        />
      ) : (
        <EnvelopeCover
          coupleName={coupleName}
          guest={guest}
          labels={labels}
          onFirstInteraction={handleFirstInteraction}
          onFinish={finish}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Moongate                                                                   */
/* -------------------------------------------------------------------------- */

// PL-6: "Dear" / "Kepada Yth." and the guest's name on a personal link's cover.
type CoverGuest = { label: string; name: string };

function CoverGuestName({ guest, className }: { guest: CoverGuest; className: string }) {
  return (
    <div className={className}>
      <p className="cover-guest-label">{guest.label}</p>
      <p className="cover-guest-name serif">{guest.name}</p>
    </div>
  );
}

function MoongateCover({
  guest,
  labels,
  onFirstInteraction,
  onFinish,
}: {
  guest?: CoverGuest;
  labels: OpeningCoverLabels;
  onFirstInteraction: () => void;
  onFinish: () => void;
}) {
  const [blooming, setBlooming] = useState(false);
  const finishedRef = useRef(false);

  const finishOnce = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  }, [onFinish]);

  const open = useCallback(() => {
    if (blooming) return;
    onFirstInteraction();
    if (prefersReducedMotion()) {
      // Reduced motion: skip the staged bloom, just fade the overlay out.
      setBlooming(true);
      window.setTimeout(finishOnce, 450);
      return;
    }
    setBlooming(true);
    // Fallback in case transitionend never fires.
    window.setTimeout(finishOnce, 1300);
  }, [blooming, finishOnce, onFirstInteraction]);

  return (
    <div
      className={`moongate-stage${blooming ? " is-blooming" : ""}`}
      data-reveal={blooming ? "1" : "0"}
    >
      {/* The visible paper cover IS this hole element's box-shadow. As it
          scales up, the shadow edge sweeps outward revealing the page. */}
      <div
        className="moongate-hole"
        aria-hidden="true"
        onTransitionEnd={(event) => {
          if (event.propertyName === "transform") finishOnce();
        }}
      />
      {guest ? <CoverGuestName guest={guest} className="moongate-guest" /> : null}
      <button
        type="button"
        className="moongate-monogram"
        aria-label={labels.tapToOpen}
        onPointerDown={onFirstInteraction}
        onClick={open}
      >
        <span className="moongate-monogram-mark serif">E&middot;J</span>
      </button>
      <p className="moongate-hint">{labels.tapToOpen}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Envelope                                                                   */
/* -------------------------------------------------------------------------- */

type EnvelopeStage = 0 | 1 | 2 | 3;

function EnvelopeCover({
  coupleName,
  guest,
  labels,
  onFirstInteraction,
  onFinish,
}: {
  coupleName: string;
  guest?: CoverGuest;
  labels: OpeningCoverLabels;
  onFirstInteraction: () => void;
  onFinish: () => void;
}) {
  const [stage, setStage] = useState<EnvelopeStage>(0);
  // Set true once the flap finishes opening (tap 1) so we can drop the flap
  // behind the letter — a z-index change that happens BETWEEN animations only.
  const [flapBehind, setFlapBehind] = useState(false);
  // Hide the envelope shell once it has dropped away (tap 2 end).
  const [shellHidden, setShellHidden] = useState(false);
  // Drives the final scale-up + overlay fade after the letter unfolds (tap 3).
  const [revealing, setRevealing] = useState(false);
  const lockRef = useRef(false);
  const finishedRef = useRef(false);

  const hint =
    stage === 0
      ? labels.tapToOpen
      : stage === 1
        ? labels.tapTakeLetter
        : stage === 2
          ? labels.tapUnfold
          : "";

  const finishOnce = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  }, [onFinish]);

  const reduced = useCallback(() => prefersReducedMotion(), []);

  const advance = useCallback(() => {
    if (lockRef.current) return;
    onFirstInteraction();

    // Reduced motion: collapse the whole sequence into a single tap → fade.
    if (reduced()) {
      lockRef.current = true;
      setRevealing(true);
      window.setTimeout(finishOnce, 450);
      return;
    }

    if (stage === 0) {
      lockRef.current = true;
      setStage(1);
      // Flap rotation is 0.7s; drop it behind the letter when it lands.
      window.setTimeout(() => {
        setFlapBehind(true);
        lockRef.current = false;
      }, 760);
    } else if (stage === 1) {
      lockRef.current = true;
      setStage(2);
      // Letter rises (0.8s) and shell drops away (0.6s + 0.15s delay = 0.75s).
      window.setTimeout(() => {
        setShellHidden(true);
        lockRef.current = false;
      }, 880);
    } else if (stage === 2) {
      lockRef.current = true;
      setStage(3);
      // Unfold: top flap 0.5s, bottom flap 0.5s @0.35s delay ≈ 0.85s, then a
      // 0.5s beat before the auto reveal (scale-up + overlay fade, 0.7s).
      window.setTimeout(() => {
        setRevealing(true);
      }, 1350);
      window.setTimeout(finishOnce, 1350 + 750);
    }
  }, [finishOnce, onFirstInteraction, reduced, stage]);

  return (
    <div
      className={`env-stage${revealing ? " is-revealing" : ""}`}
      data-stage={stage}
      data-flap-behind={flapBehind ? "1" : "0"}
    >
      {guest ? (
        <CoverGuestName
          guest={guest}
          className={`env-guest${stage > 0 ? " is-fading" : ""}`}
        />
      ) : null}
      <button
        type="button"
        className="env-scene-button"
        aria-label={hint || labels.tapToOpen}
        onPointerDown={onFirstInteraction}
        onClick={advance}
      >
        <div className="env-scene">
          {/* Envelope shell (back + front + flap) share a wrapper so they drop
              away together in stage 2. */}
          <div
            className={`env-shell${shellHidden ? " is-hidden" : ""}`}
            aria-hidden="true"
          >
            <span className="env-back" />
            <span className="env-front" />
            <span className="env-flap">
              <span className="env-seal serif">E&middot;J</span>
            </span>
          </div>

          {/* The tri-fold letter. Lives inside the envelope, then rises and
              unfolds into the page. */}
          <div className="env-letter" aria-hidden="true">
            <span className="env-letter-panel env-letter-top">
              <span className="env-letter-eyebrow">{labels.weddingOf}</span>
            </span>
            <span className="env-letter-panel env-letter-middle">
              <span className="env-letter-name serif">{coupleName}</span>
            </span>
            <span className="env-letter-panel env-letter-bottom">
              <span className="env-letter-date">12 . 12 . 2026</span>
            </span>
          </div>
        </div>
      </button>
      <p className={`env-hint${stage === 3 ? " is-fading" : ""}`}>{hint}</p>
    </div>
  );
}
