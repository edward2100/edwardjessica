"use client";

import {
  CalendarDays,
  CheckCircle2,
  MessageSquareText,
  Send,
  Utensils
} from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { LanguageToggle } from "@/components/site/language-toggle";
import { SaveDateSection } from "@/components/site/save-date-section";
import { StorySection } from "@/components/site/story-section";
import { copy, text } from "@/lib/i18n";
import {
  isRsvpClosed,
  mealPreferences,
  normalizeInviteCode
} from "@/lib/rsvp";
import type {
  EventKey,
  InvitationGroup,
  Language,
  MealPreference,
  RsvpStatus,
  WeddingContent
} from "@/lib/types";

export function InvitePage({
  content,
  invitation
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
}) {
  const [language, setLanguage] = useState<Language>(content.defaultLanguage);
  const [currentInvitation, setCurrentInvitation] = useState(invitation);
  const [opened, setOpened] = useState(false);
  const [showRsvpForm, setShowRsvpForm] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const c = copy[language];
  const eligibleEvents = content.events.filter((eventItem) =>
    currentInvitation.eligibleEvents.includes(eventItem.key)
  );
  const isSelfRegistered = currentInvitation.source === "generic";

  function begin() {
    setOpened(true);
    void audioRef.current?.play().catch(() => undefined);
    document.getElementById("invite-details")?.scrollIntoView({ behavior: "smooth" });
  }

  function revealRsvpForm() {
    setShowRsvpForm(true);
    window.setTimeout(() => {
      document.getElementById("rsvp-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  return (
    <main className="app-shell">
      {content.musicUrl ? <audio ref={audioRef} src={content.musicUrl} loop preload="none" /> : null}
      <section className="hero">
        <Image className="hero-image" src={content.heroImageUrl} alt="" fill priority sizes="100vw" />
        <div className="hero-content">
          <div>
            <LanguageToggle language={language} onChange={setLanguage} />
            <p className="hero-kicker" style={{ marginTop: 34 }}>
              {currentInvitation.greeting}
            </p>
            <h1 className="hero-title serif">{content.coupleName}</h1>
            <p className="hero-meta">
              {text(content.openingText, language)}
            </p>
            <div className="hero-actions hero-actions-centered">
              <button className="button button-primary hero-open-button" type="button" onClick={begin}>
                OPEN INVITATION
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="invite-details">
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
              />
            </figure>
          </div>
        </div>
      </section>

      <SaveDateSection content={content} labels={c} />

      <section className="section">
        <div className="container">
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
                  {eventItem.note ? <p className="muted">{text(eventItem.note, language)}</p> : null}
                </div>
                <a
                  className="button button-muted"
                  href="/api/calendar"
                  download="edward-jessica-wedding.ics"
                >
                  <CalendarDays size={17} />
                  {c.addToCalendar}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <StorySection imageUrl={content.storyImageUrl} language={language} />

      {content.gallery.length ? (
        <section className="section">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{c.gallery}</p>
                <h2 className="title serif">White, Champagne, Gold</h2>
              </div>
            </div>
            <div className="gallery-grid">
              {content.gallery.map((asset) => (
                <figure className="gallery-item" key={asset.id}>
                  <Image src={asset.url} alt={text(asset.alt, language)} fill sizes="(max-width: 860px) 100vw, 33vw" />
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
              <p className="eyebrow">{c.rsvp}</p>
              <h2 className="serif" style={{ fontSize: "clamp(2.2rem, 6vw, 5rem)", lineHeight: 0.95 }}>
                {currentInvitation.rsvp.status === "pending"
                  ? "Kindly confirm your presence"
                  : isSelfRegistered && currentInvitation.rsvp.status === "attending"
                    ? "Tentatively accepted"
                    : "Your RSVP is saved"}
              </h2>
              <p className="muted" style={{ marginTop: 14 }}>
                {currentInvitation.groupName} · RSVP deadline: 1 September 2026
                {isSelfRegistered ? " · Admins may update final status" : ""}
              </p>
            </div>
            <button className="button button-primary rsvp-main-button" type="button" onClick={revealRsvpForm}>
              <Send size={18} />
              {currentInvitation.rsvp.status === "pending" ? c.submitRsvp : c.updateRsvp}
            </button>
          </div>

          {showRsvpForm ? (
            <div id="rsvp-form" className="rsvp-grid" style={{ marginTop: 24 }}>
              <div>
                <p className="eyebrow">{c.rsvp}</p>
                <h2 className="title serif">{currentInvitation.groupName}</h2>
                <p className="muted" style={{ marginTop: 14 }}>
                  {c.noPlusOne}
                </p>
              </div>
              <RsvpForm
                content={content}
                invitation={currentInvitation}
                language={language}
                onSaved={setCurrentInvitation}
              />
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function RsvpForm({
  content,
  invitation,
  language,
  onSaved
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
  language: Language;
  onSaved: (invitation: InvitationGroup) => void;
}) {
  const c = copy[language];
  const [status, setStatus] = useState<RsvpStatus>(
    invitation.rsvp.status === "pending" ? "attending" : invitation.rsvp.status
  );
  const [eventAttendance, setEventAttendance] = useState<Partial<Record<EventKey, boolean>>>(
    Object.fromEntries(invitation.eligibleEvents.map((eventKey) => [eventKey, invitation.rsvp.eventAttendance[eventKey] ?? true]))
  );
  const [mealPrefs, setMealPrefs] = useState<Record<string, MealPreference>>(
    Object.fromEntries(invitation.guests.map((guest) => [guest.id, guest.mealPreference || "unset"]))
  );
  const [message, setMessage] = useState(invitation.rsvp.message || "");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const closed = useMemo(() => isRsvpClosed(content.rsvpDeadline), [content.rsvpDeadline]);
  const events = content.events.filter((eventItem) => invitation.eligibleEvents.includes(eventItem.key));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (closed) return;
    setLoading(true);
    setNotice("");
    const response = await fetch("/api/rsvp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: normalizeInviteCode(invitation.code),
        status,
        eventAttendance: status === "declined" ? {} : eventAttendance,
        mealPreferences: mealPrefs,
        message
      })
    });
    const json = (await response.json()) as { invitation?: InvitationGroup; error?: string };
    setLoading(false);
    if (!response.ok || !json.invitation) {
      setNotice(json.error || "Unable to save RSVP.");
      return;
    }
    onSaved(json.invitation);
    setNotice(c.thanks);
  }

  return (
    <form className="invite-panel" onSubmit={submit}>
      <div className="choice-row">
        <div>
          <p className="eyebrow">Status</p>
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
                      [eventItem.key]: event.target.checked
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <p className="eyebrow">
              <Utensils size={14} style={{ display: "inline", marginRight: 4 }} />
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
                      [guest.id]: event.target.value as MealPreference
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
          </div>
        </>
      ) : null}

      <div className="form-field" style={{ marginTop: 18 }}>
        <label htmlFor="message">
          <MessageSquareText size={14} style={{ display: "inline", marginRight: 4 }} />
          Message
        </label>
        <textarea
          className="textarea"
          id="message"
          value={message}
          disabled={closed}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      {closed ? <p className="muted" style={{ marginTop: 14 }}>{c.deadlineClosed}</p> : null}
      {notice ? (
        <p className="muted" style={{ marginTop: 14 }}>
          <CheckCircle2 size={16} style={{ display: "inline", marginRight: 6 }} />
          {notice}
        </p>
      ) : null}
      <button className="button button-muted" type="submit" disabled={closed || loading} style={{ marginTop: 20 }}>
        {loading ? "Saving..." : invitation.rsvp.status === "pending" ? c.submitRsvp : c.updateRsvp}
      </button>
    </form>
  );
}
