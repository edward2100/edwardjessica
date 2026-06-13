"use client";

import { CheckCircle2, LockKeyhole, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { FormEvent, useEffect, useRef, useState } from "react";
import { RegisterBackgroundMusic } from "@/components/site/background-music";
import { GuestMenu } from "@/components/site/guest-menu";
import { LanguageToggle } from "@/components/site/language-toggle";
import { SlotImage } from "@/components/site/slot-image";
import {
  discoverMedanHref,
  invitationHref,
  publicInvitationHref,
  travelAccommodationHref,
} from "@/lib/guest-navigation";
import { travelPageCopy } from "@/lib/guest-page-copy";
import { copy } from "@/lib/i18n";
import { getStoredLanguage, storeLanguage } from "@/lib/language-preference";
import type {
  InvitationGroup,
  Language,
  PublicInviteFlow,
  TravelAccommodationOption,
  TravelPlan,
  WeddingContent,
} from "@/lib/types";

function inviteSessionKey(flow: PublicInviteFlow) {
  return `edward-jessica-${flow}-invite-code`;
}

/** Format a YYYY-MM-DD date (no time) to a readable form, e.g. "11 Dec 2026". */
function formatDateOnly(dateStr: string, language: Language): string {
  try {
    // Parse as a plain date; append T00:00 so it isn't shifted by timezone.
    return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${dateStr}T00:00:00`));
  } catch {
    return dateStr;
  }
}

/** Format an ISO datetime string in Asia/Jakarta timezone to a readable form. */
function formatJakartaDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Convert a TravelAccommodationOption to a readable label. */
function accommodationLabel(
  option: TravelAccommodationOption,
  language: Language,
): string {
  if (option === "specific_roommates") {
    return language === "id"
      ? "Sekamar dengan tamu tertentu"
      : "Specific roommates";
  }
  if (option === "own_accommodation") {
    return language === "id"
      ? "Akomodasi sendiri"
      : "Own accommodation";
  }
  return language === "id"
    ? "Teman sekamar ditentukan pasangan"
    : "Assigned by couple";
}

export function TravelAccommodationPage({
  content,
  flow,
  invitation,
  requestedCode,
  codeFoundButWrongFlow,
  existingTravelPlan,
}: {
  content: WeddingContent;
  flow: PublicInviteFlow;
  invitation?: InvitationGroup | null;
  requestedCode?: string;
  /** E2-5: true when code is valid but the guest's invitation is not an
   *  overseas/family flow — show a "not applicable" notice instead of the form. */
  codeFoundButWrongFlow?: boolean;
  /** B1: pre-existing travel plan for this invitation, passed by the route page. */
  existingTravelPlan?: TravelPlan | null;
}) {
  // E2-9: initialise language from localStorage; guard for SSR with typeof-window check.
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return content.defaultLanguage;
    return getStoredLanguage() ?? content.defaultLanguage;
  });
  const router = useRouter();
  const detailsRef = useRef<HTMLElement | null>(null);
  const c = travelPageCopy[language];
  const ci = copy[language];
  // E2-5: when wrong-flow, use the invitation's code/flow for nav links but
  // treat the page as non-travel so the form stays locked.
  const activeFlow = invitation?.flow || flow;
  const isTravelFlow =
    !codeFoundButWrongFlow &&
    (activeFlow === "overseas" || activeFlow === "family");
  const activeInvitationHref = invitationHref(invitation?.code, activeFlow);
  const activeTravelHref = travelAccommodationHref(invitation?.code, activeFlow);
  const activeDiscoverHref = discoverMedanHref(invitation?.code, activeFlow);
  // Per-invitation complimentary-travel overrides (custom overseas links).
  // Absent keys keep the default offer shown.
  const travelOverrides = invitation?.travelOverrides;
  const showTransport = travelOverrides?.transportProvided !== false;
  const showAccommodation = travelOverrides?.accommodationProvided !== false;
  const overrideCheckIn = travelOverrides?.checkInDate;
  const overrideCheckOut = travelOverrides?.checkOutDate;
  const hasOverrideDates = Boolean(overrideCheckIn && overrideCheckOut);
  // Single-line transport reminder reused inside the form; null hides it.
  const transportNote = !showTransport
    ? null
    : hasOverrideDates
      ? `${c.transportBase} ${c.arrivalLabel}: ${formatDateOnly(
          overrideCheckIn as string,
          language,
        )} · ${c.departureLabel}: ${formatDateOnly(
          overrideCheckOut as string,
          language,
        )}`
      : c.transport;
  const canSubmitTravel =
    isTravelFlow && invitation?.rsvp.status === "attending";
  // E2-5: show "not applicable" notice when code found but wrong flow;
  // show "invalid code" only for genuinely unknown codes.
  const showNotApplicable = Boolean(codeFoundButWrongFlow);
  const showInvalidCode = Boolean(requestedCode && !invitation && !codeFoundButWrongFlow);

  // B1: track whether the form is currently being edited
  const [editingTravel, setEditingTravel] = useState(false);
  // B1: after a successful submit the new plan is stored here
  const [submittedPlan, setSubmittedPlan] = useState<TravelPlan | null>(
    existingTravelPlan ?? null,
  );

  const showSubmittedCard = Boolean(submittedPlan) && !editingTravel;

  function handleLanguageChange(lang: Language) {
    setLanguage(lang);
    storeLanguage(lang);
  }

  useEffect(() => {
    if (invitation && isTravelFlow) {
      window.localStorage.setItem(inviteSessionKey(invitation.flow), invitation.code);
      return;
    }
    // E2-1: clear the stored code when the page resolved it as invalid.
    if (requestedCode && !invitation) {
      window.localStorage.removeItem(inviteSessionKey(activeFlow));
      return;
    }
    if (!requestedCode) {
      const storedCode = window.localStorage.getItem(inviteSessionKey(activeFlow));
      if (storedCode) {
        // E2-1: validate the stored code via the resolve endpoint before
        // redirecting, to avoid an infinite redirect loop on a stale code.
        // E2-2: use router.replace (client navigation) so the music provider
        // is preserved across the navigation.
        void fetch(
          `/api/guest-auth/resolve-invite?flow=${encodeURIComponent(activeFlow)}`,
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((data: { invitation?: { code?: string } } | null) => {
            const resolvedCode = data?.invitation?.code;
            if (resolvedCode === storedCode) {
              // Stored code matches the verified session — safe to redirect.
              router.replace(
                `/travel-accommodation?code=${encodeURIComponent(storedCode)}`,
              );
            } else {
              // Session does not match or no session: stale stored code — remove it.
              window.localStorage.removeItem(inviteSessionKey(activeFlow));
            }
          })
          .catch(() => {
            // Network error: remove stale code to avoid a redirect loop.
            window.localStorage.removeItem(inviteSessionKey(activeFlow));
          });
      }
    }
  }, [activeFlow, invitation, isTravelFlow, requestedCode, router]);


  return (
    <main className="app-shell travel-page">
      <GuestMenu
        discoverHref={activeDiscoverHref}
        flow={activeFlow}
        invitationHref={activeInvitationHref}
        language={language}
        travelHref={activeTravelHref}
      />
      <RegisterBackgroundMusic src={content.musicUrl} />
      <section className="hero travel-hero">
        <SlotImage
          content={content}
          slot="travelHero"
          alt=""
          className="hero-image"
          priority
        />
        <div className="hero-content travel-hero-content">
          <div className="travel-hero-inner">
            <LanguageToggle language={language} onChange={handleLanguageChange} />
            {c.heroKicker ? (
              <p className="hero-kicker" style={{ marginTop: 34 }}>
                {c.heroKicker}
              </p>
            ) : null}
            <h1 className="hero-title serif">{c.heroTitle}</h1>
            <p className="hero-meta">{c.heroSubtitle}</p>
          </div>
        </div>
      </section>

      <section className="section" id="travel-details" ref={detailsRef}>
        <div className="page-shell travel-section-stack">
          {showInvalidCode ? (
            <p className="travel-notice">{c.invalidCode}</p>
          ) : null}
          {/* E2-5: generic-flow guests have a valid invitation but this page
              does not apply to them — greet them but explain the situation. */}
          {showNotApplicable ? (
            <p className="travel-notice">
              {language === "id"
                ? "Halaman ini khusus untuk tamu dari luar kota. Undangan Anda tidak memerlukan rencana perjalanan dan akomodasi."
                : "This page is for out-of-town guests. Your invitation does not include travel plans and accommodation."}
            </p>
          ) : null}
          <article className="travel-detail-section">
            <h2 className="title serif">{c.travelTitle}</h2>
            <div className="panel travel-copy-panel">
              <p>{c.travelIntro}</p>
              <div>
                <p className="eyebrow">{c.arrivalTitle}</p>
                <p className="muted">{c.airport}</p>
                {content.travelAirportImageUrl ? (
                  <SlotImage
                    content={content}
                    slot="travelAirport"
                    alt=""
                    className="travel-airport-photo"
                  />
                ) : null}
                {showTransport ? (
                  hasOverrideDates ? (
                    <>
                      <p className="muted">{c.transportBase}</p>
                      <p className="muted">
                        {c.arrivalLabel}:{" "}
                        {formatDateOnly(overrideCheckIn as string, language)}
                        {" · "}
                        {c.departureLabel}:{" "}
                        {formatDateOnly(overrideCheckOut as string, language)}
                      </p>
                    </>
                  ) : (
                    <p className="muted">{c.transport}</p>
                  )
                ) : null}
              </div>
              <div>
                <p>{c.fromAirport}</p>
                <ol className="travel-list travel-list-numbered">
                  <li>
                    {c.railink} {c.trainSchedule}{" "}
                    <a
                      href="https://www.railink.co.id/schedule"
                      target="_blank"
                      rel="noreferrer"
                    >
                      railink.co.id/schedule
                    </a>{" "}
                    {c.trainScheduleFrom}
                    <br />
                    <span className="muted">{c.railinkAfter}</span>
                  </li>
                  <li>{c.taxi}</li>
                </ol>
              </div>
            </div>
          </article>

          {showAccommodation ? (
            <article className="travel-detail-section">
              <h2 className="title serif">{c.accommodationTitle}</h2>
              <div className="panel travel-copy-panel">
                {hasOverrideDates ? (
                  <>
                    <p className="muted">{c.accommodationBase}</p>
                    <p className="muted">
                      {c.checkInLabel}:{" "}
                      {formatDateOnly(overrideCheckIn as string, language)}
                      {" · "}
                      {c.checkOutLabel}:{" "}
                      {formatDateOnly(overrideCheckOut as string, language)}
                    </p>
                  </>
                ) : (
                  <p className="muted">{c.accommodation}</p>
                )}
                {content.travelAccommodationImageUrl ? (
                  <SlotImage
                    content={content}
                    slot="travelAccommodation"
                    alt=""
                    className="travel-accommodation-photo"
                  />
                ) : null}
                <div>
                  <p>{c.roomsTitle}</p>
                  <ol className="travel-list travel-list-numbered">
                    <li>{c.roomDeluxe}</li>
                    <li>{c.roomApartment}</li>
                  </ol>
                </div>
              </div>
            </article>
          ) : null}

          {content.travelFormImageUrl ? (
            <SlotImage
              content={content}
              slot="travelForm"
              alt=""
              className="travel-form-section-photo"
            />
          ) : null}

          <article className="travel-detail-section" id="travel-form">
            <h2 className="title serif">{c.formTitle}</h2>
            <p className="muted travel-form-intro">{c.formIntro}</p>

            {/* B1: submitted state card */}
            {showSubmittedCard && submittedPlan ? (
              <TravelSubmittedCard
                plan={submittedPlan}
                language={language}
                onEdit={() => setEditingTravel(true)}
                discoverHref={activeDiscoverHref}
                ci={ci}
              />
            ) : (
              <TravelPlansForm
                canSubmitTravel={canSubmitTravel}
                invitationCode={invitation?.code}
                language={language}
                flow={activeFlow}
                rsvpStatus={invitation?.rsvp.status}
                rsvpHref={
                  invitation?.code
                    ? `${activeInvitationHref}#rsvp`
                    : `${publicInvitationHref(activeFlow)}#rsvp`
                }
                initialPlan={editingTravel ? submittedPlan : null}
                onSubmitSuccess={(plan) => {
                  setSubmittedPlan(plan);
                  setEditingTravel(false);
                }}
                transportNote={transportNote}
              />
            )}
          </article>
        </div>
      </section>
    </main>
  );
}

/** B1: Card shown after travel plans have been submitted. */
function TravelSubmittedCard({
  plan,
  language,
  onEdit,
  discoverHref,
  ci,
}: {
  plan: TravelPlan;
  language: Language;
  onEdit: () => void;
  discoverHref: string;
  ci: (typeof copy)[Language];
}) {
  return (
    <div className="invite-panel travel-form travel-submitted-card">
      <div className="travel-submitted-icon">
        <CheckCircle2 size={24} />
      </div>
      <p className="eyebrow" style={{ marginTop: 8 }}>
        {ci.travelSubmittedNote}
      </p>
      <dl className="travel-submitted-details">
        <div className="travel-submitted-row">
          <dt className="muted">
            {language === "id" ? "Kedatangan" : "Arrival"}
          </dt>
          <dd>{formatJakartaDate(plan.arrivalAt)}</dd>
        </div>
        <div className="travel-submitted-row">
          <dt className="muted">
            {language === "id" ? "Kepulangan" : "Departure"}
          </dt>
          <dd>{formatJakartaDate(plan.departureAt)}</dd>
        </div>
        <div className="travel-submitted-row">
          <dt className="muted">
            {language === "id" ? "Akomodasi" : "Accommodation"}
          </dt>
          <dd>{accommodationLabel(plan.accommodationOption, language)}</dd>
        </div>
        {plan.preferredRoommates ? (
          <div className="travel-submitted-row">
            <dt className="muted">
              {language === "id" ? "Teman sekamar" : "Roommates"}
            </dt>
            <dd>{plan.preferredRoommates}</dd>
          </div>
        ) : null}
      </dl>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 16,
        }}
      >
        <button
          className="button button-brown"
          type="button"
          onClick={onEdit}
        >
          {ci.updateTravelPlans}
        </button>
        <Link className="button button-primary" href={discoverHref as Route}>
          {ci.medanGuide}
        </Link>
      </div>
    </div>
  );
}

function TravelPlansForm({
  canSubmitTravel,
  flow,
  invitationCode,
  language,
  rsvpStatus,
  rsvpHref,
  initialPlan,
  onSubmitSuccess,
  transportNote,
}: {
  canSubmitTravel: boolean;
  flow: PublicInviteFlow;
  invitationCode?: string;
  language: Language;
  rsvpStatus?: InvitationGroup["rsvp"]["status"];
  rsvpHref: string;
  /** B1: when editing, pre-fill the form with the existing plan. */
  initialPlan?: TravelPlan | null;
  /** B1: callback invoked with the saved plan on successful submit. */
  onSubmitSuccess?: (plan: TravelPlan) => void;
  /** Resolved complimentary-transport reminder; null when transport is off. */
  transportNote?: string | null;
}) {
  const c = travelPageCopy[language];
  const isFamilyFlow = flow === "family";
  const isDeclined = rsvpStatus === "declined";

  // B3: local datetime string for an ISO date
  function isoToLocal(iso?: string): string {
    if (!iso) return "";
    try {
      // Convert ISO to local datetime-local value in Asia/Jakarta
      const d = new Date(iso);
      // Format as YYYY-MM-DDTHH:MM in Jakarta time
      const jakartaStr = d.toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" });
      // sv-SE gives "YYYY-MM-DD HH:MM:SS" — trim seconds and replace space with T
      return jakartaStr.slice(0, 16).replace(" ", "T");
    } catch {
      return "";
    }
  }

  const [arrivalAt, setArrivalAt] = useState(
    initialPlan ? isoToLocal(initialPlan.arrivalAt) : "",
  );
  const [departureAt, setDepartureAt] = useState(
    initialPlan ? isoToLocal(initialPlan.departureAt) : "",
  );
  const [accommodationOption, setAccommodationOption] =
    useState<TravelAccommodationOption>(
      initialPlan?.accommodationOption ?? "assign_roommates",
    );
  const [preferredRoommates, setPreferredRoommates] = useState(
    initialPlan?.preferredRoommates ?? "",
  );
  const [notice, setNotice] = useState("");
  const [emailWarning, setEmailWarning] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitTravel || !invitationCode) return;
    setNotice("");
    setEmailWarning(false);
    setLoading(true);
    // E2-9: wrap fetch in try/catch so a network error clears the loading state.
    try {
      const response = await fetch("/api/travel-plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: invitationCode,
          arrivalAt: toJakartaIso(arrivalAt),
          departureAt: toJakartaIso(departureAt),
          accommodationOption: isFamilyFlow ? "assign_roommates" : accommodationOption,
          preferredRoommates:
            !isFamilyFlow && accommodationOption === "specific_roommates"
              ? preferredRoommates
              : "",
        }),
      });
      const json = (await response.json()) as {
        error?: string;
        emailStatus?: "sent" | "failed" | "skipped";
        travelPlan?: TravelPlan;
      };
      setLoading(false);
      if (!response.ok) {
        setNotice(language === "id" ? c.unable : json.error || c.unable);
        return;
      }
      // B1: surface the saved plan to the parent via callback
      if (json.travelPlan && onSubmitSuccess) {
        onSubmitSuccess(json.travelPlan);
        return;
      }
      // Fallback: no plan returned from API — show inline success message
      setNotice(c.saved);
      if (json.emailStatus === "failed" || json.emailStatus === "skipped") {
        setEmailWarning(true);
      }
    } catch {
      setLoading(false);
      setNotice(c.unable);
    }
  }

  return (
    <form className="invite-panel travel-form" onSubmit={submit}>
      <div className="travel-form-heading">
        <div>
          <p className="eyebrow">{c.formTitle}</p>
          {!canSubmitTravel ? (
            <p className="muted" style={{ marginTop: 8 }}>
              <LockKeyhole
                size={15}
                style={{ display: "inline", marginRight: 6 }}
              />
              {isDeclined ? c.declinedTitle : c.lockedTitle}
            </p>
          ) : null}
        </div>
      </div>
      <p className="muted travel-locked-copy">
        {canSubmitTravel ? (
          transportNote ?? null
        ) : isDeclined ? (
          c.declinedCopy
        ) : (
          <>
            {c.lockedCopy}{" "}
            <Link className="travel-inline-link" href={rsvpHref as Route}>
              {c.rsvpHere}
            </Link>
          </>
        )}
      </p>

      <label className="form-field" htmlFor="travel-arrival">
        <span>{c.arrivalField}</span>
        <input
          className="input"
          disabled={!canSubmitTravel}
          id="travel-arrival"
          min="2026-12-01T00:00"
          type="datetime-local"
          value={arrivalAt}
          onChange={(event) => {
            setArrivalAt(event.target.value);
            // B3: keep departure min >= arrival
            if (departureAt && event.target.value && event.target.value > departureAt) {
              setDepartureAt(event.target.value);
            }
          }}
          required
        />
      </label>

      <label className="form-field" htmlFor="travel-departure">
        <span>{c.departureField}</span>
        <input
          className="input"
          disabled={!canSubmitTravel}
          id="travel-departure"
          min={arrivalAt || "2026-12-01T00:00"}
          type="datetime-local"
          value={departureAt}
          onChange={(event) => setDepartureAt(event.target.value)}
          required
        />
      </label>

      {isFamilyFlow ? (
        <p className="muted travel-family-note">{c.familyAccommodationNote}</p>
      ) : (
        <div className="form-field">
          <span>{c.accommodationField}</span>
          <label className="choice-row">
            <span>{c.specificRoommates}</span>
            <input
              checked={accommodationOption === "specific_roommates"}
              disabled={!canSubmitTravel}
              name="accommodation"
              type="radio"
              value="specific_roommates"
              onChange={() => setAccommodationOption("specific_roommates")}
            />
          </label>
          {accommodationOption === "specific_roommates" ? (
            <label className="form-field" htmlFor="travel-roommates">
              <span>{c.preferredRoommates}</span>
              <textarea
                className="textarea"
                disabled={!canSubmitTravel}
                id="travel-roommates"
                placeholder={c.roommatePlaceholder}
                value={preferredRoommates}
                onChange={(event) => setPreferredRoommates(event.target.value)}
                required={canSubmitTravel}
              />
            </label>
          ) : null}
          <label className="choice-row">
            <span>{c.assignRoommates}</span>
            <input
              checked={accommodationOption === "assign_roommates"}
              disabled={!canSubmitTravel}
              name="accommodation"
              type="radio"
              value="assign_roommates"
              onChange={() => setAccommodationOption("assign_roommates")}
            />
          </label>
          <label className="choice-row">
            <span>{c.ownAccommodation}</span>
            <input
              checked={accommodationOption === "own_accommodation"}
              disabled={!canSubmitTravel}
              name="accommodation"
              type="radio"
              value="own_accommodation"
              onChange={() => setAccommodationOption("own_accommodation")}
            />
          </label>
        </div>
      )}

      {notice ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {notice === c.saved ? (
            <CheckCircle2
              size={16}
              style={{ display: "inline", marginRight: 6 }}
            />
          ) : null}
          {notice}
        </p>
      ) : null}
      {/* E2-9 / shared contract: email delivery warning */}
      {emailWarning ? (
        <p className="muted" style={{ marginTop: 8 }}>
          {language === "id"
            ? "Kami tidak dapat mengirim email konfirmasi — mohon simpan tautan halaman ini."
            : "We could not send your confirmation email — please save this page link."}
        </p>
      ) : null}

      <button
        className="button button-brown"
        disabled={!canSubmitTravel || loading}
        type="submit"
      >
        <Send size={17} />
        {loading ? c.saving : c.submit}
      </button>
    </form>
  );
}

function toJakartaIso(value: string) {
  return value ? new Date(`${value}:00+07:00`).toISOString() : "";
}
