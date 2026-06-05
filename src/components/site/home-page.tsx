"use client";

import { CalendarDays, ChevronDown, MapPin, Music2, Send } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { copy, text } from "@/lib/i18n";
import { buildGoogleCalendarUrl, normalizeInviteCode } from "@/lib/rsvp";
import type { Language, WeddingContent } from "@/lib/types";
import { LanguageToggle } from "@/components/site/language-toggle";

export function HomePage({ content }: { content: WeddingContent }) {
  const [language, setLanguage] = useState<Language>(content.defaultLanguage);
  const [code, setCode] = useState("");
  const [opened, setOpened] = useState(false);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const c = copy[language];
  const firstEventCalendar = useMemo(
    () => buildGoogleCalendarUrl(content.events[0], content.coupleName, content.timezone),
    [content]
  );

  function begin() {
    setOpened(true);
    void audioRef.current?.play().catch(() => undefined);
    document.getElementById("details")?.scrollIntoView({ behavior: "smooth" });
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeInviteCode(code);
    if (normalized) router.push(`/invite/${encodeURIComponent(normalized)}`);
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
              {c.weddingOf}
            </p>
            <h1 className="hero-title serif">{content.coupleName.replace("&", "+")}</h1>
            <p className="hero-meta">
              Saturday, 12 December 2026 · Grand City Hall Medan
            </p>
            <div className="hero-actions">
              <button className="button button-primary" type="button" onClick={begin}>
                <ChevronDown size={18} />
                {c.letsBegin}
              </button>
              <a className="button button-secondary" href={firstEventCalendar} target="_blank" rel="noreferrer">
                <CalendarDays size={18} />
                {c.addToCalendar}
              </a>
              <a className="button button-secondary" href={content.venue.mapsUrl} target="_blank" rel="noreferrer">
                <MapPin size={18} />
                {c.openMap}
              </a>
            </div>
            <form className="code-form" method="get" action="/go" onSubmit={submitCode}>
              <input
                value={code}
                name="code"
                onChange={(event) => setCode(event.target.value)}
                placeholder={c.enterCode}
                aria-label={c.enterCode}
              />
              <button className="button button-primary" type="submit">
                <Send size={16} />
                {c.openInvite}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="section" id="details">
        <div className="container grid-2">
          <div>
            <p className="eyebrow">{c.details}</p>
            <h2 className="title serif">{text(content.openingText, language)}</h2>
          </div>
          <div className="panel">
            <p>{text(content.introText, language)}</p>
            <p className="muted" style={{ marginTop: 18 }}>
              {text(content.coupleBio, language)}
            </p>
            <p className="muted" style={{ marginTop: 18 }}>
              {c.noPlusOne}
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{c.schedule}</p>
              <h2 className="title serif">12.12.2026</h2>
            </div>
            {content.musicUrl ? (
              <button className="button button-muted" type="button" onClick={() => audioRef.current?.play()}>
                <Music2 size={17} />
                {c.music}
              </button>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {content.events.map((eventItem) => (
              <article className="event-row" key={eventItem.key}>
                <div>
                  <p className="eyebrow">{eventItem.startTime}</p>
                </div>
                <div>
                  <h3 className="serif" style={{ fontSize: "1.65rem" }}>
                    {text(eventItem.title, language)}
                  </h3>
                  <p className="muted">{eventItem.venueName}</p>
                  {eventItem.note ? <p className="muted">{text(eventItem.note, language)}</p> : null}
                </div>
                <a
                  className="button button-muted"
                  href={buildGoogleCalendarUrl(eventItem, content.coupleName, content.timezone)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <CalendarDays size={17} />
                  {c.addToCalendar}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid-2">
          <div>
            <p className="eyebrow">{c.story}</p>
            <h2 className="title serif">{content.groomName} + {content.brideName}</h2>
          </div>
          <div className="panel">
            <p>{text(content.loveStory, language)}</p>
            <p className="muted" style={{ marginTop: 18 }}>{text(content.proposalStory, language)}</p>
            <p className="muted" style={{ marginTop: 18 }}>
              {c.parents}: {content.parents.groom.join(" / ")} and {content.parents.bride.join(" / ")}.
            </p>
          </div>
        </div>
      </section>

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

      <section className="section">
        <div className="container grid-2">
          <div>
            <p className="eyebrow">{c.venue}</p>
            <h2 className="title serif">{content.venue.name}</h2>
          </div>
          <div className="panel">
            <p>{content.venue.address}</p>
            <p className="muted" style={{ marginTop: 14 }}>
              {c.parking}: {text(content.venue.parking, language)}
            </p>
            <a className="button button-muted" href={content.venue.mapsUrl} target="_blank" rel="noreferrer" style={{ marginTop: 22 }}>
              <MapPin size={17} />
              {c.openMap}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
