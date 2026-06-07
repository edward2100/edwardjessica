"use client";

import { CalendarDays, CheckCircle2, Send, Users, Utensils } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { LanguageToggle } from "@/components/site/language-toggle";
import { SaveDateSection } from "@/components/site/save-date-section";
import { StorySection } from "@/components/site/story-section";
import { copy, text } from "@/lib/i18n";
import type { EventKey, InvitationGroup, Language, MealPreference, WeddingContent } from "@/lib/types";

export function SelfRegisterInvitePage({
  content,
  accessCode
}: {
  content: WeddingContent;
  accessCode: string;
}) {
  const [language, setLanguage] = useState<Language>(content.defaultLanguage);
  const [savedInvitation, setSavedInvitation] = useState<InvitationGroup | null>(null);
  const [showRsvpForm, setShowRsvpForm] = useState(false);
  const detailsRef = useRef<HTMLElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const c = copy[language];

  function begin() {
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function revealForm() {
    setShowRsvpForm(true);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <Image className="hero-image" src={content.heroImageUrl} alt="" fill priority sizes="100vw" />
        <div className="hero-content">
          <div>
            <LanguageToggle language={language} onChange={setLanguage} />
            <p className="hero-kicker" style={{ marginTop: 34 }}>
              {c.genericInviteGreeting}
            </p>
            <h1 className="hero-title serif">{content.coupleName}</h1>
            <p className="hero-meta">{text(content.openingText, language)}</p>
            <div className="hero-actions hero-actions-centered">
              <button className="button button-primary hero-open-button" type="button" onClick={begin}>
                OPEN INVITATION
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
      ) : null}

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
              <p className="eyebrow">Register RSVP</p>
              <h2 className="serif" style={{ fontSize: "clamp(2.2rem, 6vw, 5rem)", lineHeight: 0.95 }}>
                {savedInvitation ? "Your RSVP is saved" : "Ready to RSVP?"}
              </h2>
              <p className="muted" style={{ marginTop: 14 }}>
                {savedInvitation
                  ? "Thank you. Your RSVP has been saved below."
                  : "Please review the wedding details above before registering your attendance."}
              </p>
            </div>
            {savedInvitation ? null : (
              <button className="button button-primary rsvp-main-button" type="button" onClick={revealForm}>
                <Users size={18} />
                Register RSVP
              </button>
            )}
          </div>

          {showRsvpForm || savedInvitation ? (
            <div ref={formRef} id="self-rsvp-form" className="rsvp-grid" style={{ marginTop: 24 }}>
              <div>
                <p className="eyebrow">Register RSVP</p>
                <h2 className="title serif">Tell us who is coming</h2>
                <p className="muted" style={{ marginTop: 14 }}>
                  This creates a guest group instantly from the generic code.
                </p>
              </div>
              {savedInvitation ? (
                <div className="invite-panel">
                  <p className="eyebrow">
                    <CheckCircle2 size={15} style={{ display: "inline", marginRight: 6 }} />
                    RSVP saved
                  </p>
                  <h3 className="serif" style={{ fontSize: "2rem", marginTop: 10 }}>
                    Thank you, {savedInvitation.groupName}
                  </h3>
                  <p className="muted" style={{ marginTop: 12 }}>
                    Your RSVP has been tentatively accepted and counted. Your personal invitation code is{" "}
                    {savedInvitation.code}.
                  </p>
                  <Link className="button button-muted" href={`/invite/${savedInvitation.code}`} style={{ marginTop: 20 }}>
                    View your invite
                  </Link>
                </div>
              ) : (
                <SelfRegisterForm
                  accessCode={accessCode}
                  events={content.events}
                  language={language}
                  onSaved={setSavedInvitation}
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
  accessCode,
  events,
  language,
  onSaved
}: {
  accessCode: string;
  events: WeddingContent["events"];
  language: Language;
  onSaved: (invitation: InvitationGroup) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [mealPreference, setMealPreference] = useState<Exclude<MealPreference, "unset">>("non_vegetarian");
  const [status, setStatus] = useState<"attending" | "declined">("attending");
  const [eventAttendance, setEventAttendance] = useState<Partial<Record<EventKey, boolean>>>(
    Object.fromEntries(events.map((eventItem) => [eventItem.key, true]))
  );
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setLoading(true);
    const response = await fetch("/api/rsvp/self-register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accessCode,
        name,
        phone,
        guestCount,
        mealPreference,
        status,
        eventAttendance: status === "attending" ? eventAttendance : {},
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
  }

  return (
    <form className="invite-panel" onSubmit={submit}>
      <div className="form-field">
        <label htmlFor="self-name">Name</label>
        <input
          className="input"
          id="self-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="form-field" style={{ marginTop: 14 }}>
        <label htmlFor="self-phone">Phone / WhatsApp</label>
        <input
          className="input"
          id="self-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <label className="form-field" htmlFor="self-count">
          <span>
            <Users size={14} style={{ display: "inline", marginRight: 4 }} />
            Guest count
          </span>
          <input
            className="input"
            id="self-count"
            type="number"
            min={1}
            max={10}
            value={guestCount}
            onChange={(event) => setGuestCount(Number(event.target.value))}
            required
          />
        </label>
        <label className="form-field" htmlFor="self-meal">
          <span>
            <Utensils size={14} style={{ display: "inline", marginRight: 4 }} />
            Meal choice
          </span>
          <select
            className="select"
            id="self-meal"
            value={mealPreference}
            onChange={(event) => setMealPreference(event.target.value as Exclude<MealPreference, "unset">)}
          >
            <option value="non_vegetarian">Non-vegetarian</option>
            <option value="vegetarian">Vegetarian</option>
          </select>
        </label>
      </div>
      <div className="form-field" style={{ marginTop: 14 }}>
        <label htmlFor="self-status">RSVP</label>
        <select
          className="select"
          id="self-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as "attending" | "declined")}
        >
          <option value="attending">Attending</option>
          <option value="declined">Not attending</option>
        </select>
      </div>
      {status === "attending" ? (
        <div style={{ marginTop: 18 }}>
          <p className="eyebrow">Events</p>
          {events.map((eventItem) => (
            <label className="choice-row" key={eventItem.key}>
              <span>{text(eventItem.shortTitle, language)}</span>
              <input
                type="checkbox"
                checked={Boolean(eventAttendance[eventItem.key])}
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
      ) : null}
      <div className="form-field" style={{ marginTop: 14 }}>
        <label htmlFor="self-message">Message</label>
        <textarea
          className="textarea"
          id="self-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      {notice ? <p className="muted" style={{ marginTop: 12 }}>{notice}</p> : null}
      <button className="button button-muted" type="submit" disabled={loading} style={{ marginTop: 20 }}>
        <Send size={17} />
        {loading ? "Saving..." : "Save RSVP"}
      </button>
    </form>
  );
}
