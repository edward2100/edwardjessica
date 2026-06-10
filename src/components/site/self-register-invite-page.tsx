"use client";

import {
  CalendarDays,
  Send,
  Users,
  Utensils,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { CSSProperties } from "react";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  RegisterBackgroundMusic,
  useBackgroundMusic,
} from "@/components/site/background-music";
import { EmailOtpGate } from "@/components/site/email-otp-gate";
import { FloatingRsvpButton } from "@/components/site/floating-rsvp-button";
import { GuestMenu } from "@/components/site/guest-menu";
import { LanguageToggle } from "@/components/site/language-toggle";
import { PhoneCountryInput } from "@/components/site/phone-country-input";
import { SaveDateSection } from "@/components/site/save-date-section";
import { StorySection } from "@/components/site/story-section";
import {
  discoverMedanHref,
  invitationHref,
  travelAccommodationHref,
} from "@/lib/guest-navigation";
import { imageCropStyleVars } from "@/lib/image-crop";
import { copy, text } from "@/lib/i18n";
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
  const [language, setLanguage] = useState<Language>(content.defaultLanguage);
  const [hasOpenedInvitation, setHasOpenedInvitation] = useState(false);
  const [savedInvitation, setSavedInvitation] =
    useState<InvitationGroup | null>(null);
  const [showRsvpForm, setShowRsvpForm] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [isResolvingInvite, setIsResolvingInvite] = useState(false);
  const music = useBackgroundMusic();
  const router = useRouter();
  const detailsRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const c = copy[language];
  const activeCode = savedInvitation?.code;
  const currentInvitationHref = invitationHref(activeCode, inviteType.flow);
  const currentTravelHref = travelAccommodationHref(activeCode, inviteType.flow);
  const currentDiscoverHref = discoverMedanHref(activeCode, inviteType.flow);

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

  function revealForm() {
    setShowRsvpForm(true);
    void resolveExistingSession();
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  async function resolveExistingSession() {
    setIsResolvingInvite(true);
    const response = await fetch(
      `/api/guest-auth/resolve-invite?flow=${encodeURIComponent(inviteType.flow)}`,
    );
    const json = (await response.json()) as {
      verified?: boolean;
      invitation?: InvitationGroup;
    };
    setIsResolvingInvite(false);
    if (response.ok && json.invitation?.code) {
      setSavedInvitation(json.invitation);
      if (inviteType.flow === "overseas" || inviteType.flow === "family") {
        window.localStorage.setItem(
          `edward-jessica-${inviteType.flow}-invite-code`,
          json.invitation.code,
        );
      }
      router.push(`/invite/${encodeURIComponent(json.invitation.code)}` as Route);
    }
  }

  async function resolveVerifiedEmail(email: string) {
    setIsResolvingInvite(true);
    const response = await fetch(
      `/api/guest-auth/resolve-invite?flow=${encodeURIComponent(inviteType.flow)}`,
    );
    const json = (await response.json()) as {
      invitation?: InvitationGroup;
    };
    setIsResolvingInvite(false);
    if (response.ok && json.invitation?.code) {
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
    setVerifiedEmail(email);
  }

  function openSavedInvitation(invitation: InvitationGroup) {
    setSavedInvitation(invitation);
    if (inviteType.flow === "overseas" || inviteType.flow === "family") {
      window.localStorage.setItem(
        `edward-jessica-${inviteType.flow}-invite-code`,
        invitation.code,
      );
    }
    router.push(`/invite/${encodeURIComponent(invitation.code)}` as Route);
  }

  useEffect(() => {
    function openRsvpFromHash() {
      if (window.location.hash !== "#rsvp") return;
      setHasOpenedInvitation(true);
      setShowRsvpForm(true);
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
      <section className="hero">
        <Image
          className="hero-image"
          src={content.heroImageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          style={imageCropStyleVars(content, "hero") as CSSProperties}
        />
        <div className="hero-content">
          <div>
            <LanguageToggle language={language} onChange={setLanguage} />
            <p className="hero-kicker" style={{ marginTop: 34 }}>
              {c.genericInviteGreeting}
            </p>
            <h1 className="hero-title serif">{content.coupleName}</h1>
            <p className="hero-meta">{text(content.openingText, language)}</p>
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
          </div>
        </div>
      </section>

      <section className="section" ref={detailsRef}>
        <div className="container">
          <div className="centered-section-copy">
            <p className="eyebrow">{c.details}</p>
            <h2 className="title serif">{text(content.introText, language)}</h2>
            <figure className="invitation-section-photo">
              <Image
                src={content.invitationImageUrl}
                alt=""
                fill
                sizes="(max-width: 860px) calc(100vw - 48px), 980px"
                style={
                  imageCropStyleVars(content, "invitation") as CSSProperties
                }
              />
            </figure>
          </div>
        </div>
      </section>

      <SaveDateSection content={content} labels={c} />

      {content.events.length ? (
        <section className="section">
          <div className="container">
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
                  <a
                    className="button button-muted"
                    href="/api/calendar"
                    download="edward-jessica-wedding.ics"
                  >
                    <CalendarDays size={17} />
                    {c.addFullSchedule}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <StorySection
        imageCrop={content.imageCrops.story}
        imageUrl={content.storyImageUrl}
        language={language}
      />

      {content.gallery.length ? (
        <section className="section">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{c.gallery}</p>
                <h2 className="title serif">{c.galleryTitle}</h2>
              </div>
            </div>
            <div className="gallery-grid">
              {content.gallery.map((asset) => (
                <figure className="gallery-item" key={asset.id}>
                  <Image
                    src={asset.url}
                    alt={text(asset.alt, language)}
                    fill
                    sizes="(max-width: 860px) 100vw, 33vw"
                    unoptimized
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section" id="rsvp">
        <div className="container">
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

          {showRsvpForm || savedInvitation ? (
            <div
              ref={formRef}
              id="self-rsvp-form"
              className="rsvp-grid"
              style={{ marginTop: 24 }}
            >
              <div>
                <p className="eyebrow">{c.registerRsvp}</p>
                <h2 className="title serif">{c.tellUsWhoIsComing}</h2>
                <p className="muted" style={{ marginTop: 14 }}>
                  {c.guestCountHint.replace(
                    "{count}",
                    String(inviteType.maxGuests),
                  )}
                </p>
              </div>
              {savedInvitation || isResolvingInvite ? (
                <div className="invite-panel">
                  <p className="eyebrow">{c.rsvpSavedTitle}</p>
                  <h3 className="serif" style={{ fontSize: "2rem", marginTop: 10 }}>
                    {isResolvingInvite
                      ? c.checkingExistingRsvp
                      : c.openingPersonalInvite}
                  </h3>
                  <p className="muted" style={{ marginTop: 12 }}>
                    {savedInvitation
                      ? c.receivedRsvp
                      : c.verifyEmailIntro}
                  </p>
                </div>
              ) : verifiedEmail ? (
                  <SelfRegisterForm
                    content={content}
                    events={content.events}
                    inviteType={inviteType}
                    language={language}
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
  onSaved,
}: {
  content: WeddingContent;
  events: WeddingContent["events"];
  inviteType: PublicInviteType;
  language: Language;
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (closed) return;
    setNotice("");
    setLoading(true);
    const finalGuestNames = resolvedGuestNames();
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
    if (inviteType.flow === "overseas" || inviteType.flow === "family") {
      window.localStorage.setItem(
        `edward-jessica-${inviteType.flow}-invite-code`,
        json.invitation.code,
      );
    }
    onSaved(json.invitation);
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
