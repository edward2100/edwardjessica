"use client";

import {
  CalendarDays,
  MapPin,
  Send,
  Users,
  Utensils,
} from "lucide-react";
import { InteractiveGallery } from "@/components/site/interactive-gallery";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  RegisterBackgroundMusic,
  useBackgroundMusic,
} from "@/components/site/background-music";
import { EmailOtpGate } from "@/components/site/email-otp-gate";
import { FloatingRsvpButton } from "@/components/site/floating-rsvp-button";
import { GuestMenu } from "@/components/site/guest-menu";
import { LanguageToggle } from "@/components/site/language-toggle";
import { OpeningCover } from "@/components/site/opening-cover";
import { PhoneCountryInput } from "@/components/site/phone-country-input";
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
import { isRsvpClosed } from "@/lib/rsvp";
import type {
  EventKey,
  InvitationGroup,
  Language,
  MealPreference,
  PublicInviteType,
  WeddingContent,
} from "@/lib/types";

export function SelfRegisterInvitePage({
  content,
  inviteType,
}: {
  content: WeddingContent;
  inviteType: PublicInviteType;
}) {
  // E1-2: initialize from localStorage; useState initializer runs client-side only (this is a "use client" component)
  const [language, setLanguage] = useState<Language>(
    () => getStoredLanguage() ?? content.defaultLanguage,
  );
  const [hasOpenedInvitation, setHasOpenedInvitation] = useState(false);
  const [savedInvitation, setSavedInvitation] =
    useState<InvitationGroup | null>(null);
  // Whether the RSVP was just submitted — shows success card instead of redirecting immediately
  const [rsvpJustSaved, setRsvpJustSaved] = useState(false);
  const [showRsvpForm, setShowRsvpForm] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [isResolvingInvite, setIsResolvingInvite] = useState(false);
  // E1-6: track email delivery status from API response
  const [emailStatus, setEmailStatus] = useState<
    "sent" | "failed" | "skipped" | null
  >(null);
  const music = useBackgroundMusic();
  const router = useRouter();
  const detailsRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  // E1-2: persist language on toggle
  function handleLanguageChange(lang: Language) {
    setLanguage(lang);
    storeLanguage(lang);
  }

  const c = copy[language];
  const activeCode = savedInvitation?.code;
  const currentInvitationHref = invitationHref(activeCode, inviteType.flow);
  const currentTravelHref = travelAccommodationHref(activeCode, inviteType.flow);
  const currentDiscoverHref = discoverMedanHref(activeCode, inviteType.flow);
  const isTravelFlow = inviteType.flow === "overseas" || inviteType.flow === "family";

  const rsvpClosed = useMemo(
    () => isRsvpClosed(content.rsvpDeadline),
    [content.rsvpDeadline],
  );

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

  function revealForm() {
    setShowRsvpForm(true);
    setRsvpJustSaved(false);
    void resolveExistingSession();
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  // E1-1: wrapped in try/catch so a network failure clears loading instead of freezing UI
  async function resolveExistingSession() {
    setIsResolvingInvite(true);
    try {
      const response = await fetch(
        `/api/guest-auth/resolve-invite?flow=${encodeURIComponent(inviteType.flow)}`,
      );
      const json = (await response.json()) as {
        verified?: boolean;
        invitation?: InvitationGroup;
      };
      setIsResolvingInvite(false);
      if (response.ok && json.invitation?.code) {
        // E1-8: if the resolved invitation belongs to a different flow, redirect to its own page
        setSavedInvitation(json.invitation);
        if (inviteType.flow === "overseas" || inviteType.flow === "family") {
          window.localStorage.setItem(
            `edward-jessica-${inviteType.flow}-invite-code`,
            json.invitation.code,
          );
        }
        router.push(`/invite/${encodeURIComponent(json.invitation.code)}` as Route);
      }
    } catch {
      setIsResolvingInvite(false);
      // Network error: stay on the form so the guest can proceed manually
    }
  }

  // E1-1 + E1-8: wrapped in try/catch; cross-flow invitations redirect to their canonical page
  async function resolveVerifiedEmail(email: string) {
    setIsResolvingInvite(true);
    try {
      const response = await fetch(
        `/api/guest-auth/resolve-invite?flow=${encodeURIComponent(inviteType.flow)}`,
      );
      const json = (await response.json()) as {
        invitation?: InvitationGroup;
      };
      setIsResolvingInvite(false);
      if (response.ok && json.invitation?.code) {
        // E1-8: redirect to the invitation's own page regardless of flow match
        setSavedInvitation(json.invitation);
        if (inviteType.flow === "overseas" || inviteType.flow === "family") {
          window.localStorage.setItem(
            `edward-jessica-${inviteType.flow}-invite-code`,
            json.invitation.code,
          );
        }
        router.push(`/invite/${encodeURIComponent(json.invitation.code)}` as Route);
        return;
      }
    } catch {
      setIsResolvingInvite(false);
      // Network error: fall through and let the guest fill in the self-register form
    }
    setVerifiedEmail(email);
  }

  /**
   * Called when SelfRegisterForm completes successfully.
   * Shows the success card (with a "View my invitation" button) instead of
   * an immediate hard redirect — preserving client nav + music.
   */
  function openSavedInvitation(invitation: InvitationGroup) {
    setSavedInvitation(invitation);
    setRsvpJustSaved(true);
    setShowRsvpForm(false);
    if (inviteType.flow === "overseas" || inviteType.flow === "family") {
      window.localStorage.setItem(
        `edward-jessica-${inviteType.flow}-invite-code`,
        invitation.code,
      );
    }
    window.setTimeout(() => {
      document
        .getElementById("self-rsvp-success")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function navigateToPersonalInvite() {
    if (!savedInvitation) return;
    router.push(`/invite/${encodeURIComponent(savedInvitation.code)}` as Route);
  }

  useEffect(() => {
    // E1-3: run the same resolve-invite check that revealForm() runs, so a returning guest
    // landing via #rsvp deep link gets redirected to their personal invite page.
    function openRsvpFromHash() {
      if (window.location.hash !== "#rsvp") return;
      setHasOpenedInvitation(true);
      setShowRsvpForm(true);
      void resolveExistingSession();
      window.setTimeout(() => {
        formRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    }

    openRsvpFromHash();
    window.addEventListener("hashchange", openRsvpFromHash);
    return () => window.removeEventListener("hashchange", openRsvpFromHash);
    // resolveExistingSession is stable (no deps that change identity); eslint-disable if needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={`app-shell ${hasOpenedInvitation ? "" : "hero-locked"}`}>
      <GuestMenu
        discoverHref={currentDiscoverHref}
        flow={inviteType.flow}
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
              {c.genericInviteGreeting}
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
      <section className="section" ref={detailsRef}>
        <div className="page-shell">
          <div className="centered-section-copy">
            <p className="eyebrow">{c.details}</p>
            <h2 className="title serif">{text(content.introText, language)}</h2>
            <div style={{ marginTop: "clamp(42px, 7vw, 76px)" }}>
              <SlotImage content={content} slot="invitation" alt="" />
            </div>
          </div>
        </div>
      </section>

      <BrideGroomSection content={content} language={language} />

      <SaveDateSection content={content} labels={c} />

      {content.events.length ? (
        <section className="section">
          <div className="page-shell">
            <div className="section-heading section-heading-centered">
              <div>
                <p className="eyebrow">{c.schedule}</p>
                <h2 className="title serif">{c.scheduleTitle}</h2>
              </div>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {content.events.map((eventItem) => (
                <article className="event-row" key={eventItem.key}>
                  <p className="eyebrow">{eventItem.startTime}</p>
                  <div>
                    <h3 className="serif" style={{ fontSize: "1.55rem" }}>
                      {text(eventItem.title, language)}
                    </h3>
                    <p className="muted">{eventItem.venueName}</p>
                    {eventItem.note ? (
                      <p className="muted">{text(eventItem.note, language)}</p>
                    ) : null}
                  </div>
                  {/* F6: per-event action is the location link only */}
                  {eventItem.mapUrl ? (
                    <div
                      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                    >
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
      ) : null}

      <StorySection content={content} language={language} />

      {content.gallery.length ? (
        <section className="section">
          <div className="page-shell">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{c.gallery}</p>
                <h2 className="title serif">{c.galleryTitle}</h2>
              </div>
            </div>
            <InteractiveGallery assets={content.gallery} />
          </div>
        </section>
      ) : null}

      <section className="section" id="rsvp">
        <div className="page-shell">
          {/* E1-4: show a closed notice when the invite type is disabled */}
          {!inviteType.isEnabled || rsvpClosed ? (
            <div className="rsvp-callout">
              <div>
                <p className="eyebrow">{c.registerRsvp}</p>
                <h2
                  className="serif"
                  style={{
                    fontSize: "clamp(2.2rem, 6vw, 5rem)",
                    lineHeight: 0.95,
                  }}
                >
                  {rsvpClosed ? c.rsvpClosed : (language === "id"
                    ? "Pendaftaran ditutup"
                    : "Registration closed")}
                </h2>
                <p className="muted" style={{ marginTop: 14 }}>
                  {rsvpClosed
                    ? c.rsvpClosedContact
                    : language === "id"
                      ? "Pendaftaran untuk undangan ini sudah ditutup. Mohon hubungi kami jika ada pertanyaan."
                      : "Registration for this invitation is no longer available. Please contact us if you have any questions."}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Hide the "Ready to confirm?" callout once the RSVP is
                  confirmed — the success card below replaces it. */}
              {!rsvpJustSaved ? (
                <div className="rsvp-callout">
                  <div>
                    <p className="eyebrow">{c.registerRsvp}</p>
                    <h2
                      className="serif"
                      style={{
                        fontSize: "clamp(2.2rem, 6vw, 5rem)",
                        lineHeight: 0.95,
                      }}
                    >
                      {savedInvitation ? c.rsvpSavedTitle : c.readyToRsvp}
                    </h2>
                    <p className="muted" style={{ marginTop: 14 }}>
                      {savedInvitation
                        ? c.receivedRsvp
                        : `${c.reviewBeforeRsvp} ${formatDeadlineCopy(c.rsvpBy, content.rsvpDeadline, content.timezone, language)}.`}
                    </p>
                    {/* Countdown line */}
                    <SelfRegRsvpCountdownLine
                      deadlineIso={content.rsvpDeadline}
                      language={language}
                    />
                  </div>
                  {savedInvitation ? null : (
                    <button
                      className="button button-primary rsvp-main-button"
                      type="button"
                      onClick={revealForm}
                    >
                      <Users size={18} />
                      {c.registerRsvp}
                    </button>
                  )}
                </div>
              ) : null}

              {/* Success card shown immediately after registration */}
              {rsvpJustSaved && savedInvitation ? (
                <div id="self-rsvp-success" style={{ marginTop: 24 }}>
                  <SelfRegisterSuccessCard
                    content={content}
                    invitation={savedInvitation}
                    invitationHref={currentInvitationHref}
                    language={language}
                    emailStatus={emailStatus}
                    isTravelFlow={isTravelFlow}
                    travelHref={currentTravelHref}
                    onViewInvite={navigateToPersonalInvite}
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

              {showRsvpForm && !rsvpJustSaved ? (
                <div
                  ref={formRef}
                  id="self-rsvp-form"
                  className="rsvp-grid"
                  style={{ marginTop: 24 }}
                >
                  <div>
                    {/* Heading lives in the OTP box on the right; keep only the
                        eyebrow + guest-count note here to avoid duplication. */}
                    <p className="eyebrow">{c.registerRsvp}</p>
                    <p className="muted" style={{ marginTop: 14 }}>
                      {c.guestCountHint.replace(
                        "{count}",
                        String(inviteType.maxGuests),
                      )}
                    </p>
                  </div>
                  {isResolvingInvite ? (
                    <div className="invite-panel">
                      <p className="eyebrow">{c.rsvpSavedTitle}</p>
                      <h3 className="serif" style={{ fontSize: "2rem", marginTop: 10 }}>
                        {c.checkingExistingRsvp}
                      </h3>
                      <p className="muted" style={{ marginTop: 12 }}>
                        {c.verifyEmailIntro}
                      </p>
                    </div>
                  ) : verifiedEmail ? (
                    <SelfRegisterForm
                      content={content}
                      events={content.events}
                      inviteType={inviteType}
                      language={language}
                      onEmailStatus={setEmailStatus}
                      onSaved={openSavedInvitation}
                    />
                  ) : (
                    <EmailOtpGate
                      autoVerifySession={false}
                      language={language}
                      onVerified={resolveVerifiedEmail}
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

function SelfRegisterForm({
  content,
  events,
  inviteType,
  language,
  onEmailStatus,
  onSaved,
}: {
  content: WeddingContent;
  events: WeddingContent["events"];
  inviteType: PublicInviteType;
  language: Language;
  onEmailStatus: (status: "sent" | "failed" | "skipped") => void;
  onSaved: (invitation: InvitationGroup) => void;
}) {
  const c = copy[language];
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [guestNames, setGuestNames] = useState<string[]>([""]);
  const [mealPreference, setMealPreference] =
    useState<Exclude<MealPreference, "unset">>("non_vegetarian");
  const [status, setStatus] = useState<"attending" | "declined">("attending");
  const [eventAttendance, setEventAttendance] = useState<
    Partial<Record<EventKey, boolean>>
  >(Object.fromEntries(events.map((eventItem) => [eventItem.key, true])));
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const closed = isRsvpClosed(content.rsvpDeadline);
  const maxGuests = Math.max(1, inviteType.maxGuests || 1);
  const isAttending = status === "attending";
  const needsEveryGuestName =
    isAttending &&
    (inviteType.requireGuestNames || inviteType.flow === "family");
  const needsPlusOneName =
    isAttending && !needsEveryGuestName && guestCount > 1;

  function setCount(nextCount: number) {
    const normalizedCount = Math.min(maxGuests, Math.max(1, nextCount || 1));
    setGuestCount(normalizedCount);
    setGuestNames((current) =>
      Array.from(
        { length: normalizedCount },
        (_, index) => current[index] || "",
      ),
    );
  }

  function setGuestName(index: number, value: string) {
    setGuestNames((current) =>
      Array.from({ length: guestCount }, (_, guestIndex) =>
        guestIndex === index ? value : current[guestIndex] || "",
      ),
    );
  }

  function resolvedGuestNames() {
    if (needsEveryGuestName) {
      return Array.from(
        { length: guestCount },
        (_, index) => guestNames[index]?.trim() || "",
      );
    }
    if (needsPlusOneName) return [name.trim(), guestNames[1]?.trim() || ""];
    return [name.trim()];
  }

  // E1-1: wrapped in try/catch to prevent UI freeze on network failure
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (closed) return;
    setNotice("");
    setLoading(true);
    const finalGuestNames = resolvedGuestNames();
    try {
      const response = await fetch("/api/rsvp/self-register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accessCode: inviteType.code,
          name,
          phone,
          guestCount,
          guestNames: finalGuestNames,
          mealPreference,
          status,
          eventAttendance: status === "attending" ? eventAttendance : {},
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
      if (inviteType.flow === "overseas" || inviteType.flow === "family") {
        window.localStorage.setItem(
          `edward-jessica-${inviteType.flow}-invite-code`,
          json.invitation.code,
        );
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
      <div className="form-field">
        <label htmlFor="self-name">
          {needsEveryGuestName ? c.contactName : c.yourName}
        </label>
        <input
          className="input"
          id="self-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div style={{ marginTop: 14 }}>
        <PhoneCountryInput
          id="self-phone"
          label={c.phoneWhatsApp}
          onChange={setPhone}
          required
          value={phone}
        />
      </div>
      <div className="form-field" style={{ marginTop: 14 }}>
        <label htmlFor="self-status">{c.rsvp}</label>
        <select
          className="select"
          id="self-status"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as "attending" | "declined")
          }
        >
          <option value="attending">{c.attending}</option>
          <option value="declined">{c.notAttending}</option>
        </select>
      </div>

      {isAttending ? (
        <>
          <div className="grid-2" style={{ marginTop: 14 }}>
            <label className="form-field" htmlFor="self-count">
              <span>
                <Users
                  size={14}
                  style={{ display: "inline", marginRight: 4 }}
                />
                {c.guestCount}
              </span>
              <input
                className="input"
                id="self-count"
                type="number"
                min={1}
                max={maxGuests}
                value={guestCount}
                onChange={(event) => setCount(Number(event.target.value))}
                required
              />
            </label>
            <label className="form-field" htmlFor="self-meal">
              <span>
                <Utensils
                  size={14}
                  style={{ display: "inline", marginRight: 4 }}
                />
                {c.mealChoice}
              </span>
              <select
                className="select"
                id="self-meal"
                value={mealPreference}
                onChange={(event) =>
                  setMealPreference(
                    event.target.value as Exclude<MealPreference, "unset">,
                  )
                }
              >
                <option value="non_vegetarian">{c.nonVegetarian}</option>
                <option value="vegetarian">{c.vegetarian}</option>
              </select>
            </label>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {c.guestCountHint.replace("{count}", String(maxGuests))}
          </p>

          {needsEveryGuestName ? (
            <div style={{ marginTop: 18 }}>
              <p className="eyebrow">{c.guestNames}</p>
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {Array.from({ length: guestCount }, (_, index) => (
                  <label
                    className="form-field"
                    htmlFor={`self-guest-name-${index}`}
                    key={index}
                  >
                    <span>
                      {c.guestName.replace("{number}", String(index + 1))}
                    </span>
                    <input
                      className="input"
                      id={`self-guest-name-${index}`}
                      value={guestNames[index] || ""}
                      onChange={(event) =>
                        setGuestName(index, event.target.value)
                      }
                      required
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {needsPlusOneName ? (
            <label
              className="form-field"
              htmlFor="self-plus-one-name"
              style={{ marginTop: 14 }}
            >
              <span>{c.plusOneName}</span>
              <input
                className="input"
                id="self-plus-one-name"
                value={guestNames[1] || ""}
                onChange={(event) => setGuestName(1, event.target.value)}
                required
              />
            </label>
          ) : null}

          <div style={{ marginTop: 18 }}>
            <p className="eyebrow">{c.events}</p>
            {events.map((eventItem) => (
              <label className="choice-row" key={eventItem.key}>
                <span>{text(eventItem.shortTitle, language)}</span>
                <input
                  type="checkbox"
                  checked={Boolean(eventAttendance[eventItem.key])}
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
        </>
      ) : null}
      <div className="form-field" style={{ marginTop: 14 }}>
        <label htmlFor="self-message">{c.message}</label>
        <textarea
          className="textarea"
          id="self-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      {closed ? (
        <p className="muted" style={{ marginTop: 14 }}>
          {c.deadlineClosed}
        </p>
      ) : null}
      {notice ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {notice}
        </p>
      ) : null}
      <button
        className="button button-muted"
        type="submit"
        disabled={closed || loading}
        style={{ marginTop: 20 }}
      >
        <Send size={17} />
        {loading ? c.saving : c.saveRsvp}
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

/** Days-left countdown for the self-register page. */
function SelfRegRsvpCountdownLine({
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
 * Success card shown after self-registration completes.
 * The guest sees their summary here and clicks "View my invitation"
 * to navigate to their personal invite page.
 */
function SelfRegisterSuccessCard({
  content,
  invitation,
  invitationHref,
  language,
  emailStatus,
  isTravelFlow,
  travelHref,
  onViewInvite,
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
  invitationHref: string;
  language: Language;
  emailStatus: "sent" | "failed" | "skipped" | null;
  isTravelFlow: boolean;
  travelHref: string;
  onViewInvite: () => void;
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
        <p className="eyebrow" style={{ fontSize: "0.72rem" }}>
          {c.viewYourInvite}
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
          {language === "id"
            ? "Simpan tautan ini untuk mengakses undangan Anda kapan saja."
            : "Save this link to access your invitation anytime."}
        </p>
      </div>

      {/* Actions */}
      <div className="confirmation-actions" style={{ justifyContent: "center" }}>
        {/* Primary: view invitation — navigates to personal page */}
        <button
          className="button button-primary"
          type="button"
          onClick={onViewInvite}
        >
          {c.viewYourInvite}
        </button>
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
      </div>
    </div>
  );
}
