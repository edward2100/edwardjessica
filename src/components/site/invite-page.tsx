"use client";

import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  MessageSquareText,
  Send,
  Utensils,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { InteractiveGallery } from "@/components/site/interactive-gallery";
import Link from "next/link";
import type { Route } from "next";
import {
  RegisterBackgroundMusic,
  useBackgroundMusic,
} from "@/components/site/background-music";
import { EmailOtpGate } from "@/components/site/email-otp-gate";
import { FloatingRsvpButton } from "@/components/site/floating-rsvp-button";
import { GuestMenu } from "@/components/site/guest-menu";
import { LanguageToggle } from "@/components/site/language-toggle";
import { OpeningCover } from "@/components/site/opening-cover";
import { BrideGroomSection } from "@/components/site/bride-groom-section";
import { SaveDateSection } from "@/components/site/save-date-section";
import { SlotImage } from "@/components/site/slot-image";
import { StorySection } from "@/components/site/story-section";
import {
  discoverMedanHref,
  invitationHref,
  travelAccommodationHref,
} from "@/lib/guest-navigation";
import { copy, text } from "@/lib/i18n";
import { getStoredLanguage, storeLanguage } from "@/lib/language-preference";
import { isRsvpClosed, mealPreferences, normalizeInviteCode } from "@/lib/rsvp";
import type {
  EventKey,
  InvitationGroup,
  Language,
  MealPreference,
  RsvpStatus,
  WeddingContent,
} from "@/lib/types";

export function InvitePage({
  content,
  invitation,
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
}) {
  // E1-2: initialize from localStorage; useState initializer runs client-side only (this is a "use client" component)
  const [language, setLanguage] = useState<Language>(
    () => getStoredLanguage() ?? content.defaultLanguage,
  );
  const [currentInvitation, setCurrentInvitation] = useState(invitation);
  const [hasOpenedInvitation, setHasOpenedInvitation] = useState(false);
  const [showRsvpForm, setShowRsvpForm] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  // Track whether the RSVP was just saved in this session (for success card)
  const [rsvpJustSaved, setRsvpJustSaved] = useState(false);
  // E1-6: track email delivery status from API response
  const [emailStatus, setEmailStatus] = useState<
    "sent" | "failed" | "skipped" | null
  >(null);
  const music = useBackgroundMusic();
  const detailsRef = useRef<HTMLElement | null>(null);
  const c = copy[language];
  const eligibleEvents = content.events.filter((eventItem) =>
    currentInvitation.eligibleEvents.includes(eventItem.key),
  );
  const isSelfRegistered = currentInvitation.source === "generic";
  const isTravelFlow =
    currentInvitation.flow === "overseas" || currentInvitation.flow === "family";
  const currentInvitationHref = invitationHref(
    currentInvitation.code,
    currentInvitation.flow,
  );
  const currentTravelHref = travelAccommodationHref(
    currentInvitation.code,
    currentInvitation.flow,
  );
  const currentDiscoverHref = discoverMedanHref(
    currentInvitation.code,
    currentInvitation.flow,
  );
  const rsvpMeta = [
    currentInvitation.groupName,
    formatDeadlineCopy(
      c.rsvpBy,
      content.rsvpDeadline,
      content.timezone,
      language,
    ),
    isSelfRegistered ? c.adminMayFollowUp : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const rsvpClosed = useMemo(
    () => isRsvpClosed(content.rsvpDeadline),
    [content.rsvpDeadline],
  );

  // E1-2: persist language on toggle
  function handleLanguageChange(lang: Language) {
    setLanguage(lang);
    storeLanguage(lang);
  }

  // Non-classic opening animations replace the hero "Open Invitation" button
  // with a full-screen cover, and the reveal lands guests on the hero top
  // (no auto-scroll to details).
  const useCover = content.openingAnimation !== "classic";

  function begin() {
    setHasOpenedInvitation(true);
    music.play();
    window.requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  // Cover reveal completed: unlock the page WITHOUT scrolling to details.
  function openFromCover() {
    setHasOpenedInvitation(true);
  }

  function revealRsvpForm() {
    setShowRsvpForm(true);
    setRsvpJustSaved(false);
    window.setTimeout(() => {
      document
        .getElementById("rsvp-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function handleRsvpSaved(saved: InvitationGroup) {
    setCurrentInvitation(saved);
    setRsvpJustSaved(true);
    setShowRsvpForm(false);
    window.setTimeout(() => {
      document
        .getElementById("rsvp-success")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  useEffect(() => {
    if (isTravelFlow) {
      window.localStorage.setItem(
        `edward-jessica-${currentInvitation.flow}-invite-code`,
        currentInvitation.code,
      );
    }
  }, [currentInvitation.code, currentInvitation.flow, isTravelFlow]);

  useEffect(() => {
    function openRsvpFromHash() {
      if (window.location.hash !== "#rsvp") return;
      setHasOpenedInvitation(true);
      setShowRsvpForm(true);
      window.setTimeout(() => {
        document
          .getElementById("rsvp-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }

    openRsvpFromHash();
    window.addEventListener("hashchange", openRsvpFromHash);
    return () => window.removeEventListener("hashchange", openRsvpFromHash);
  }, []);

  return (
    <main className={`app-shell ${hasOpenedInvitation ? "" : "hero-locked"}`}>
      <GuestMenu
        discoverHref={currentDiscoverHref}
        flow={currentInvitation.flow}
        invitationHref={currentInvitationHref}
        language={language}
        travelHref={currentTravelHref}
      />
      {hasOpenedInvitation ? <FloatingRsvpButton /> : null}
      <RegisterBackgroundMusic src={content.musicUrl} />

      {useCover && !hasOpenedInvitation ? (
        <OpeningCover
          variant={content.openingAnimation as "moongate" | "envelope"}
          coupleName={content.coupleName}
          language={language}
          onLanguageChange={handleLanguageChange}
          labels={c}
          onOpened={openFromCover}
          onFirstInteraction={music.play}
        />
      ) : null}

      {/* Hero — full-bleed, uses SlotImage for mobile/desktop source resolution */}
      <section className="hero">
        <SlotImage
          content={content}
          slot="hero"
          alt=""
          className="hero-image"
          priority
        />
        <div className="hero-content">
          <div>
            <LanguageToggle language={language} onChange={handleLanguageChange} />
            <p className="hero-kicker" style={{ marginTop: 34 }}>
              {currentInvitation.greeting}
            </p>
            <h1 className="hero-title serif">{content.coupleName}</h1>
            <p className="hero-meta">{text(content.openingText, language)}</p>
            {useCover ? null : (
              <div className="hero-actions hero-actions-centered">
                <button
                  className="button button-primary hero-open-button"
                  type="button"
                  onClick={begin}
                  onPointerDown={music.play}
                >
                  {c.openInvitation}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* F3: all content sections wrapped in .page-shell */}
      <section className="section" id="invite-details" ref={detailsRef}>
        <div className="page-shell">
          <div className="centered-section-copy">
            <p className="eyebrow">{c.details}</p>
            <h2 className="title serif">{text(content.introText, language)}</h2>
            <div style={{ marginTop: "clamp(42px, 7vw, 76px)" }}>
              <SlotImage
                content={content}
                slot="invitation"
                alt=""
                className="invitation-section-photo"
              />
            </div>
          </div>
        </div>
      </section>

      <BrideGroomSection content={content} language={language} />

      <SaveDateSection content={content} labels={c} />

      <section className="section">
        <div className="page-shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{c.schedule}</p>
              <h2 className="title serif">{c.scheduleTitle}</h2>
            </div>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {eligibleEvents.map((eventItem) => (
              <article className="event-row" key={eventItem.key}>
                <p className="eyebrow">{eventItem.startTime}</p>
                <div>
                  <h3 className="serif" style={{ fontSize: "1.55rem" }}>
                    {text(eventItem.title, language)}
                  </h3>
                  <p className="muted">{eventItem.venueName}</p>
                  {eventItem.note ? (
                    <p className="muted" style={{ whiteSpace: "pre-line" }}>
                      {text(eventItem.note, language)}
                    </p>
                  ) : null}
                </div>
                {/* F6: per-event action is the location link only */}
                {eventItem.mapUrl ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a
                      className="button button-muted"
                      href={eventItem.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin size={17} />
                      {c.location}
                    </a>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          {/* One Add to Calendar (full .ics) below the whole schedule */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 24,
            }}
          >
            <a
              className="button button-muted"
              href="/calendar.ics"
              download="edward-jessica-wedding.ics"
            >
              <CalendarDays size={17} />
              {c.addToCalendar}
            </a>
          </div>
        </div>
      </section>

      <StorySection content={content} language={language} />

      {content.gallery.length ? (
        <section className="section">
          <div className="page-shell">
            <InteractiveGallery assets={content.gallery} />
          </div>
        </section>
      ) : null}

      <section className="section" id="rsvp">
        <div className="page-shell">
          {rsvpClosed ? (
            /* Closed state — replace form area entirely */
            <div className="rsvp-callout">
              <div>
                <p className="eyebrow">{c.rsvp}</p>
                <h2
                  className="serif"
                  style={{ fontSize: "clamp(2.2rem, 6vw, 5rem)", lineHeight: 0.95 }}
                >
                  {c.rsvpClosed}
                </h2>
                <p className="muted" style={{ marginTop: 14 }}>
                  {c.rsvpClosedContact}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Hide the confirm/update callout once the RSVP is confirmed in
                  this session — the success card below replaces it (it has its
                  own update action). */}
              {!rsvpJustSaved ? (
                <div className="rsvp-callout">
                  <div>
                    <p className="eyebrow">{c.rsvp}</p>
                    <h2
                      className="serif"
                      style={{
                        fontSize: "clamp(2.2rem, 6vw, 5rem)",
                        lineHeight: 0.95,
                      }}
                    >
                      {currentInvitation.rsvp.status === "pending"
                        ? c.confirmPresence
                        : c.rsvpSavedTitle}
                    </h2>
                    <p className="muted" style={{ marginTop: 14 }}>
                      {rsvpMeta}
                    </p>
                    {/* Countdown line */}
                    <RsvpCountdownLine
                      deadlineIso={content.rsvpDeadline}
                      language={language}
                    />
                  </div>
                  <div className="rsvp-actions">
                    <button
                      className="button button-primary rsvp-main-button"
                      type="button"
                      onClick={revealRsvpForm}
                    >
                      <Send size={18} />
                      {currentInvitation.rsvp.status === "pending"
                        ? c.submitRsvp
                        : c.updateRsvp}
                    </button>
                    {isTravelFlow && currentInvitation.rsvp.status === "attending" ? (
                      <Link className="button button-brown" href={currentTravelHref as Route}>
                        {c.submitTravelPlans}
                      </Link>
                    ) : null}
                    {!isTravelFlow && currentInvitation.rsvp.status === "attending" ? (
                      <Link className="button button-brown" href={currentDiscoverHref as Route}>
                        {c.medanGuide}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Success card shown after a save in this session */}
              {rsvpJustSaved ? (
                <div id="rsvp-success" style={{ marginTop: 24 }}>
                  <RsvpSuccessCard
                    content={content}
                    invitation={currentInvitation}
                    invitationHref={currentInvitationHref}
                    language={language}
                    emailStatus={emailStatus}
                    isTravelFlow={isTravelFlow}
                    travelHref={currentTravelHref}
                    discoverHref={currentDiscoverHref}
                    onUpdate={revealRsvpForm}
                  />
                </div>
              ) : null}

              {/* E1-6: email confirmation notice when email could not be sent (outside success card) */}
              {!rsvpJustSaved && emailStatus && emailStatus !== "sent" ? (
                <p className="muted" style={{ marginTop: 14 }}>
                  {language === "id"
                    ? "Kami tidak dapat mengirim email konfirmasi — mohon simpan tautan halaman ini."
                    : "We could not send your confirmation email — please save this page link."}
                </p>
              ) : null}

              {showRsvpForm ? (
                <div id="rsvp-form" className="rsvp-grid" style={{ marginTop: 24 }}>
                  <div>
                    {/* Heading lives in the OTP box on the right; keep only the
                        eyebrow + guest-count note here to avoid duplication. */}
                    <p className="eyebrow">{c.rsvp}</p>
                    <p className="muted" style={{ marginTop: 14 }}>
                      {currentInvitation.maxGuests > currentInvitation.guests.length
                        ? c.guestCountHint.replace(
                            "{count}",
                            String(currentInvitation.maxGuests),
                          )
                        : c.noPlusOne}
                    </p>
                  </div>
                  {verifiedEmail ? (
                    <RsvpForm
                      content={content}
                      invitation={currentInvitation}
                      language={language}
                      onEmailStatus={setEmailStatus}
                      onSaved={handleRsvpSaved}
                    />
                  ) : (
                    <EmailOtpGate
                      autoVerifySession={Boolean(currentInvitation.emailClaimed)}
                      code={currentInvitation.code}
                      defaultEmail={currentInvitation.email}
                      language={language}
                      onVerified={setVerifiedEmail}
                    />
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function RsvpForm({
  content,
  invitation,
  language,
  onEmailStatus,
  onSaved,
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
  language: Language;
  onEmailStatus: (status: "sent" | "failed" | "skipped") => void;
  onSaved: (invitation: InvitationGroup) => void;
}) {
  const c = copy[language];
  const [status, setStatus] = useState<RsvpStatus>(
    invitation.rsvp.status === "pending" ? "attending" : invitation.rsvp.status,
  );
  const [eventAttendance, setEventAttendance] = useState<
    Partial<Record<EventKey, boolean>>
  >(
    Object.fromEntries(
      invitation.eligibleEvents.map((eventKey) => [
        eventKey,
        invitation.rsvp.eventAttendance[eventKey] ?? true,
      ]),
    ),
  );
  const [mealPrefs, setMealPrefs] = useState<Record<string, MealPreference>>(
    Object.fromEntries(
      invitation.guests.map((guest) => [
        guest.id,
        guest.mealPreference || "unset",
      ]),
    ),
  );
  // E1-5: separate primary guest from additional guests so re-submissions include existing IDs.
  // The first guest in the list is the primary; any beyond that are "additional".
  const existingAdditional = invitation.guests.slice(1);
  const maxAdditionalGuests = Math.max(
    0,
    invitation.maxGuests - invitation.guests.length,
  );
  const [additionalGuests, setAdditionalGuests] = useState(() => [
    // Pre-populate existing additional guests with their ids so the server can update rather than insert
    ...existingAdditional.map((guest) => ({
      id: guest.id,
      name: guest.name,
      mealPreference: guest.mealPreference as MealPreference,
    })),
    // Blank slots for any remaining capacity
    ...Array.from({ length: maxAdditionalGuests }, () => ({
      id: undefined as string | undefined,
      name: "",
      mealPreference: "non_vegetarian" as MealPreference,
    })),
  ]);
  const [message, setMessage] = useState(invitation.rsvp.message || "");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const closed = useMemo(
    () => isRsvpClosed(content.rsvpDeadline),
    [content.rsvpDeadline],
  );
  const events = content.events.filter((eventItem) =>
    invitation.eligibleEvents.includes(eventItem.key),
  );

  // E1-1: wrapped in try/catch to prevent UI freeze on network failure
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (closed) return;
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: normalizeInviteCode(invitation.code),
          status,
          eventAttendance: status === "declined" ? {} : eventAttendance,
          mealPreferences: mealPrefs,
          // E1-5: include id on existing additional guests so the server dedupes by id (pairs with B9)
          additionalGuests:
            status === "declined"
              ? []
              : additionalGuests
                  .map((guest) => ({
                    ...(guest.id ? { id: guest.id } : {}),
                    name: guest.name.trim(),
                    mealPreference: guest.mealPreference,
                  }))
                  .filter((guest) => guest.name),
          message,
        }),
      });
      const json = (await response.json()) as {
        invitation?: InvitationGroup;
        error?: string;
        emailStatus?: "sent" | "failed" | "skipped";
      };
      setLoading(false);
      if (!response.ok || !json.invitation) {
        setNotice(
          language === "id"
            ? c.unableToSaveRsvp
            : json.error || c.unableToSaveRsvp,
        );
        return;
      }
      // E1-6: surface email delivery status to parent
      if (json.emailStatus) {
        onEmailStatus(json.emailStatus);
      }
      onSaved(json.invitation);
    } catch {
      setLoading(false);
      setNotice(
        language === "id"
          ? "Terjadi kesalahan jaringan. Mohon coba lagi."
          : "A network error occurred. Please try again.",
      );
    }
  }

  return (
    <form className="invite-panel" onSubmit={submit}>
      <div className="choice-row">
        <div>
          <p className="eyebrow">{c.status}</p>
          <p>{status === "declined" ? c.notAttending : c.attending}</p>
        </div>
        <select
          className="select"
          value={status}
          disabled={closed}
          onChange={(event) => setStatus(event.target.value as RsvpStatus)}
          style={{ maxWidth: 190 }}
        >
          <option value="attending">{c.attending}</option>
          <option value="declined">{c.notAttending}</option>
        </select>
      </div>

      {status !== "declined" ? (
        <>
          <div style={{ marginTop: 18 }}>
            <p className="eyebrow">{c.schedule}</p>
            {events.map((eventItem) => (
              <label className="choice-row" key={eventItem.key}>
                <span>{text(eventItem.shortTitle, language)}</span>
                <input
                  type="checkbox"
                  checked={Boolean(eventAttendance[eventItem.key])}
                  disabled={closed}
                  onChange={(event) =>
                    setEventAttendance((current) => ({
                      ...current,
                      [eventItem.key]: event.target.checked,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <p className="eyebrow">
              <Utensils
                size={14}
                style={{ display: "inline", marginRight: 4 }}
              />
              {c.mealPreference}
            </p>
            {invitation.guests.map((guest) => (
              <div className="guest-meal-row" key={guest.id}>
                <span>{guest.name}</span>
                <select
                  className="select"
                  value={mealPrefs[guest.id] || "unset"}
                  disabled={closed}
                  onChange={(event) =>
                    setMealPrefs((current) => ({
                      ...current,
                      [guest.id]: event.target.value as MealPreference,
                    }))
                  }
                  style={{ maxWidth: 210 }}
                >
                  {mealPreferences.map((preference) => (
                    <option value={preference} key={preference}>
                      {preference === "vegetarian"
                        ? c.vegetarian
                        : preference === "non_vegetarian"
                          ? c.nonVegetarian
                          : "-"}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {additionalGuests.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {additionalGuests.map((guest, index) => (
                  <div className="guest-meal-row" key={`additional-${index}`}>
                    <input
                      aria-label={`${c.guestName.replace("{number}", String(invitation.guests.length + index + 1))}`}
                      className="input"
                      disabled={closed}
                      placeholder={c.guestName.replace(
                        "{number}",
                        String(invitation.guests.length + index + 1),
                      )}
                      value={guest.name}
                      onChange={(event) =>
                        setAdditionalGuests((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <select
                      className="select"
                      value={guest.mealPreference}
                      disabled={closed}
                      onChange={(event) =>
                        setAdditionalGuests((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  mealPreference: event.target
                                    .value as MealPreference,
                                }
                              : item,
                          ),
                        )
                      }
                      style={{ maxWidth: 210 }}
                    >
                      {mealPreferences.map((preference) => (
                        <option value={preference} key={preference}>
                          {preference === "vegetarian"
                            ? c.vegetarian
                            : preference === "non_vegetarian"
                              ? c.nonVegetarian
                              : "-"}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="form-field" style={{ marginTop: 18 }}>
        <label htmlFor="message">
          <MessageSquareText
            size={14}
            style={{ display: "inline", marginRight: 4 }}
          />
          {c.message}
        </label>
        <textarea
          className="textarea"
          id="message"
          value={message}
          disabled={closed}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      {closed ? (
        <p className="muted" style={{ marginTop: 14 }}>
          {c.deadlineClosed}
        </p>
      ) : null}
      {notice ? (
        <p className="muted" style={{ marginTop: 14 }}>
          <CheckCircle2
            size={16}
            style={{ display: "inline", marginRight: 6 }}
          />
          {notice}
        </p>
      ) : null}
      <button
        className="button button-muted"
        type="submit"
        disabled={closed || loading}
        style={{ marginTop: 20 }}
      >
        {loading
          ? c.saving
          : invitation.rsvp.status === "pending"
            ? c.submitRsvp
            : c.updateRsvp}
      </button>
    </form>
  );
}

function formatDeadlineCopy(
  template: string,
  deadlineIso: string,
  timezone: string,
  language: Language,
) {
  return template.replace(
    "{date}",
    formatDeadlineDate(deadlineIso, timezone, language),
  );
}

function formatDeadlineDate(
  deadlineIso: string,
  timezone: string,
  language: Language,
) {
  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(deadlineIso));
}

/**
 * Displays a days-left countdown to the RSVP deadline.
 * Switches to the urgent variant at 14 days or fewer.
 * Hidden when the deadline has already passed.
 */
function RsvpCountdownLine({
  deadlineIso,
  language,
}: {
  deadlineIso: string;
  language: Language;
}) {
  const c = copy[language];
  const now = new Date();
  const deadline = new Date(deadlineIso);
  const msLeft = deadline.getTime() - now.getTime();
  if (msLeft <= 0) return null;
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const template = daysLeft <= 14 ? c.daysLeftUrgent : c.daysLeftRsvp;
  const label = template.replace("{d}", String(daysLeft));
  return (
    <p className="muted" style={{ marginTop: 10, fontWeight: 700 }}>
      {label}
    </p>
  );
}

/**
 * Success card shown in both invite-page and self-register-invite-page
 * after a successful RSVP submission.
 */
function RsvpSuccessCard({
  content,
  invitation,
  invitationHref,
  language,
  emailStatus,
  isTravelFlow,
  travelHref,
  discoverHref,
  onUpdate,
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
  invitationHref: string;
  language: Language;
  emailStatus: "sent" | "failed" | "skipped" | null;
  isTravelFlow: boolean;
  travelHref: string;
  discoverHref: string;
  onUpdate: () => void;
}) {
  const c = copy[language];
  const attending = invitation.rsvp.status === "attending";
  const heading = attending
    ? c.successAttendingHeading
    : c.successDeclinedHeading;
  const attendingEvents = content.events.filter(
    (ev) => invitation.rsvp.eventAttendance[ev.key],
  );
  const guestNames = invitation.guests.map((g) => g.name).filter(Boolean);

  return (
    <div
      className="invite-panel"
      style={{
        padding: "clamp(24px, 5vw, 44px)",
        display: "grid",
        gap: 20,
        textAlign: "center",
      }}
    >
      {/* Flourish */}
      <div style={{ fontSize: "2.2rem", lineHeight: 1 }}>✦</div>

      <div>
        <h3
          className="serif"
          style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", lineHeight: 1.1 }}
        >
          {heading}
        </h3>
        {attending ? (
          <p className="muted" style={{ marginTop: 10 }}>
            {c.successAttendingSub}
          </p>
        ) : null}
      </div>

      {/* Summary */}
      {attending && (guestNames.length > 0 || attendingEvents.length > 0) ? (
        <div
          style={{
            borderTop: "1px solid var(--line)",
            paddingTop: 16,
            display: "grid",
            gap: 10,
            textAlign: "left",
          }}
        >
          {guestNames.length > 0 ? (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              <strong style={{ color: "var(--ink)" }}>
                {language === "id" ? "Tamu" : "Guests"}:
              </strong>{" "}
              {guestNames.join(", ")}
            </p>
          ) : null}
          {attendingEvents.length > 0 ? (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              <strong style={{ color: "var(--ink)" }}>
                {language === "id" ? "Acara" : "Events"}:
              </strong>{" "}
              {attendingEvents.map((ev) => text(ev.shortTitle, language)).join(", ")}
            </p>
          ) : null}
          {invitation.guests[0]?.mealPreference &&
          invitation.guests[0].mealPreference !== "unset" ? (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              <strong style={{ color: "var(--ink)" }}>{c.mealPreference}:</strong>{" "}
              {invitation.guests[0].mealPreference === "vegetarian"
                ? c.vegetarian
                : c.nonVegetarian}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Email delivery warning inside card */}
      {emailStatus && emailStatus !== "sent" ? (
        <p className="muted" style={{ fontSize: "0.88rem" }}>
          {language === "id"
            ? "Kami tidak dapat mengirim email konfirmasi — mohon simpan tautan halaman ini."
            : "We could not send your confirmation email — please save this page link."}
        </p>
      ) : null}

      {/* Save this link */}
      <div
        style={{
          borderTop: "1px solid var(--line)",
          paddingTop: 16,
          display: "grid",
          gap: 6,
        }}
      >
        <p
          className="eyebrow"
          style={{ fontSize: "0.72rem" }}
        >
          {c.viewYourInvite}
        </p>
        <a
          href={invitationHref}
          style={{
            color: "var(--gold)",
            fontWeight: 700,
            fontSize: "0.88rem",
            wordBreak: "break-all",
          }}
        >
          {typeof window !== "undefined"
            ? `${window.location.origin}${invitationHref}`
            : invitationHref}
        </a>
      </div>

      {/* Actions */}
      <div className="confirmation-actions" style={{ justifyContent: "center" }}>
        <a
          className="button button-muted"
          href="/calendar.ics"
          download="edward-jessica-wedding.ics"
        >
          <CalendarDays size={17} />
          {c.addToCalendar}
        </a>
        {isTravelFlow && attending ? (
          <Link className="button button-brown" href={travelHref as Route}>
            {c.submitTravelPlans}
          </Link>
        ) : null}
        {!isTravelFlow && attending ? (
          <Link className="button button-brown" href={discoverHref as Route}>
            {c.medanGuide}
          </Link>
        ) : null}
        <button className="button button-muted" type="button" onClick={onUpdate}>
          {c.updateRsvp}
        </button>
      </div>
    </div>
  );
}
