"use client";

import { CheckCircle2, LockKeyhole, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { CSSProperties } from "react";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  RegisterBackgroundMusic,
  useBackgroundMusic,
} from "@/components/site/background-music";
import { GuestMenu } from "@/components/site/guest-menu";
import { LanguageToggle } from "@/components/site/language-toggle";
import {
  discoverMedanHref,
  invitationHref,
  publicInvitationHref,
  travelAccommodationHref,
} from "@/lib/guest-navigation";
import { travelPageCopy } from "@/lib/guest-page-copy";
import { imageCropStyleVars } from "@/lib/image-crop";
import type {
  InvitationGroup,
  Language,
  PublicInviteFlow,
  TravelAccommodationOption,
  WeddingContent,
} from "@/lib/types";

function inviteSessionKey(flow: PublicInviteFlow) {
  return `edward-jessica-${flow}-invite-code`;
}

export function TravelAccommodationPage({
  content,
  flow,
  invitation,
  requestedCode,
}: {
  content: WeddingContent;
  flow: PublicInviteFlow;
  invitation?: InvitationGroup | null;
  requestedCode?: string;
}) {
  const [language, setLanguage] = useState<Language>(content.defaultLanguage);
  const music = useBackgroundMusic();
  const detailsRef = useRef<HTMLElement | null>(null);
  const c = travelPageCopy[language];
  const activeFlow = invitation?.flow || flow;
  const isTravelFlow = activeFlow === "overseas" || activeFlow === "family";
  const activeInvitationHref = invitationHref(invitation?.code, activeFlow);
  const activeTravelHref = travelAccommodationHref(invitation?.code, activeFlow);
  const activeDiscoverHref = discoverMedanHref(invitation?.code, activeFlow);
  const canSubmitTravel =
    isTravelFlow && invitation?.rsvp.status === "attending";
  const showInvalidCode = Boolean(requestedCode && !invitation);

  useEffect(() => {
    if (invitation && isTravelFlow) {
      window.localStorage.setItem(inviteSessionKey(invitation.flow), invitation.code);
      return;
    }
    if (!requestedCode) {
      const storedCode = window.localStorage.getItem(inviteSessionKey(activeFlow));
      if (storedCode) {
        window.location.replace(
          `/travel-accommodation?code=${encodeURIComponent(storedCode)}`,
        );
      }
    }
  }, [activeFlow, invitation, isTravelFlow, requestedCode]);

  function scrollToDetails() {
    music.play();
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
        <Image
          className="hero-image"
          src={
            content.travelHeroImageUrl ||
            content.invitationImageUrl ||
            content.heroImageUrl
          }
          alt=""
          fill
          priority
          sizes="100vw"
          style={imageCropStyleVars(content, "travelHero") as CSSProperties}
        />
        <div className="hero-content travel-hero-content">
          <div className="travel-hero-inner">
            <LanguageToggle language={language} onChange={setLanguage} />
            {c.heroKicker ? (
              <p className="hero-kicker" style={{ marginTop: 34 }}>
                {c.heroKicker}
              </p>
            ) : null}
            <h1 className="hero-title serif">{c.heroTitle}</h1>
            <p className="hero-meta">{c.heroSubtitle}</p>
            <div className="hero-actions travel-hero-actions">
              <button
                className="button button-primary hero-open-button"
                type="button"
                onClick={scrollToDetails}
                onPointerDown={music.play}
              >
                {c.viewDetails}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="travel-details" ref={detailsRef}>
        <div className="container travel-section-stack">
          {showInvalidCode ? (
            <p className="travel-notice">{c.invalidCode}</p>
          ) : null}
          <article className="travel-detail-section">
            <h2 className="title serif">{c.travelTitle}</h2>
            <div className="panel travel-copy-panel">
              <p>{c.travelIntro}</p>
              <div>
                <p className="eyebrow">{c.arrivalTitle}</p>
                <p className="muted">{c.airport}</p>
                {content.travelAirportImageUrl ? (
                  <figure className="travel-airport-photo">
                    <Image
                      src={content.travelAirportImageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 860px) calc(100vw - 104px), 760px"
                      style={
                        imageCropStyleVars(
                          content,
                          "travelAirport",
                        ) as CSSProperties
                      }
                    />
                  </figure>
                ) : null}
                <p className="muted">{c.transport}</p>
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

          <article className="travel-detail-section">
            <h2 className="title serif">{c.accommodationTitle}</h2>
            <div className="panel travel-copy-panel">
              <p className="muted">{c.accommodation}</p>
              {content.travelAccommodationImageUrl ? (
                <figure className="travel-accommodation-photo">
                  <Image
                    src={content.travelAccommodationImageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 860px) calc(100vw - 104px), 760px"
                    style={
                      imageCropStyleVars(
                        content,
                        "travelAccommodation",
                      ) as CSSProperties
                    }
                  />
                </figure>
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

          {content.travelFormImageUrl ? (
            <figure className="travel-form-section-photo">
              <Image
                src={content.travelFormImageUrl}
                alt=""
                fill
                sizes="(max-width: 860px) calc(100vw - 48px), 920px"
                style={
                  imageCropStyleVars(content, "travelForm") as CSSProperties
                }
              />
            </figure>
          ) : null}

          <article className="travel-detail-section" id="travel-form">
            <h2 className="title serif">{c.formTitle}</h2>
            <p className="muted travel-form-intro">{c.formIntro}</p>
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
            />
          </article>
        </div>
      </section>
    </main>
  );
}

function TravelPlansForm({
  canSubmitTravel,
  flow,
  invitationCode,
  language,
  rsvpStatus,
  rsvpHref,
}: {
  canSubmitTravel: boolean;
  flow: PublicInviteFlow;
  invitationCode?: string;
  language: Language;
  rsvpStatus?: InvitationGroup["rsvp"]["status"];
  rsvpHref: string;
}) {
  const c = travelPageCopy[language];
  const isFamilyFlow = flow === "family";
  const isDeclined = rsvpStatus === "declined";
  const [arrivalAt, setArrivalAt] = useState("");
  const [departureAt, setDepartureAt] = useState("");
  const [accommodationOption, setAccommodationOption] =
    useState<TravelAccommodationOption>("assign_roommates");
  const [preferredRoommates, setPreferredRoommates] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmitTravel || !invitationCode) return;
    setNotice("");
    setLoading(true);
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
    const json = (await response.json()) as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setNotice(language === "id" ? c.unable : json.error || c.unable);
      return;
    }
    setNotice(c.saved);
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
          c.transport
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
          min="2026-12-11T00:00"
          type="datetime-local"
          value={arrivalAt}
          onChange={(event) => setArrivalAt(event.target.value)}
          required
        />
      </label>

      <label className="form-field" htmlFor="travel-departure">
        <span>{c.departureField}</span>
        <input
          className="input"
          disabled={!canSubmitTravel}
          id="travel-departure"
          min="2026-12-11T00:00"
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
