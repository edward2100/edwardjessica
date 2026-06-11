"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  RegisterBackgroundMusic,
  useBackgroundMusic,
} from "@/components/site/background-music";
import { GuestMenu } from "@/components/site/guest-menu";
import { LanguageToggle } from "@/components/site/language-toggle";
import { SlotImage } from "@/components/site/slot-image";
import {
  discoverMedanHref,
  invitationHref,
  travelAccommodationHref,
} from "@/lib/guest-navigation";
import { getStoredLanguage, storeLanguage } from "@/lib/language-preference";
import type {
  DiscoverMedanGuideItem,
  DiscoverMedanGuideSection,
  DiscoverMedanSectionId,
  ImageCropSlot,
  InvitationGroup,
  Language,
  PublicInviteFlow,
  WeddingContent,
} from "@/lib/types";

export function DiscoverMedanPage({
  content,
  flow,
  invitation,
}: {
  content: WeddingContent;
  flow: PublicInviteFlow;
  invitation?: InvitationGroup | null;
}) {
  // E2-9: initialise language from localStorage; guard for SSR with typeof-window check.
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return content.defaultLanguage;
    return getStoredLanguage() ?? content.defaultLanguage;
  });
  const music = useBackgroundMusic();
  const guideRef = useRef<HTMLElement | null>(null);
  const c = content.discoverMedan;
  const activeFlow = invitation?.flow || flow;
  const activeCode = invitation?.code;

  function scrollToGuide() {
    music.play();
    guideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="app-shell discover-page">
      <GuestMenu
        discoverHref={discoverMedanHref(activeCode, activeFlow)}
        flow={activeFlow}
        invitationHref={invitationHref(activeCode, activeFlow)}
        language={language}
        travelHref={travelAccommodationHref(activeCode, activeFlow)}
      />
      <RegisterBackgroundMusic src={content.musicUrl} />
      {/* F5: hero title always "Discover Medan" — sourced from content.discoverMedan */}
      <section className="hero travel-hero discover-hero">
        <SlotImage
          content={content}
          slot="discoverHero"
          alt=""
          className="hero-image"
          priority
        />
        <div className="hero-content travel-hero-content">
          <div className="travel-hero-inner">
            <LanguageToggle
              language={language}
              onChange={(lang) => {
                setLanguage(lang);
                storeLanguage(lang);
              }}
            />
            {c.heroKicker[language] ? (
              <p className="hero-kicker" style={{ marginTop: 34 }}>
                {c.heroKicker[language]}
              </p>
            ) : null}
            {/* F5: page title is "Discover Medan" as a proper noun in both languages */}
            <h1 className="hero-title serif">Discover Medan</h1>
            <p className="hero-meta">{c.heroSubtitle[language]}</p>
            <div className="hero-actions travel-hero-actions">
              <button
                className="button button-primary hero-open-button"
                type="button"
                onClick={scrollToGuide}
                onPointerDown={music.play}
              >
                {c.heroButton[language]}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* F3: all content sections inside .page-shell */}
      <section className="section" ref={guideRef}>
        <div className="page-shell discover-section-stack">
          <article className="discover-intro">
            <div className="discover-intro-copy">
              <p className="eyebrow">{c.introEyebrow[language]}</p>
              <h2 className="title serif">{c.introTitle[language]}</h2>
              <div className="discover-paragraphs">
                {c.introParagraphs[language].map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
            {/* F3: adopt SlotImage for discoverIntro; className applied to slot-image-frame */}
            <SlotImage
              content={content}
              slot="discoverIntro"
              alt=""
              className="discover-intro-photo"
            />
          </article>

          {c.sections.map((section) => (
            <GuideSection
              cropSlot={sectionImageCropSlot(section.id)}
              content={content}
              key={section.id}
              language={language}
              section={section}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function sectionImageCropSlot(
  sectionId: DiscoverMedanSectionId,
): ImageCropSlot {
  if (sectionId === "localFood") return "discoverFood";
  if (sectionId === "supper") return "discoverSupper";
  return "discoverCafe";
}

function GuideSection({
  content,
  cropSlot,
  language,
  section,
}: {
  content: WeddingContent;
  cropSlot: ImageCropSlot;
  language: Language;
  section: DiscoverMedanGuideSection;
}) {
  const variant = section.id === "localFood" ? "food" : section.id;
  return (
    <section className={`discover-guide-section discover-${variant}`}>
      <div className="discover-section-header">
        <div>
          <p className="eyebrow">{section.eyebrow[language]}</p>
          <h2 className="title serif">{section.title[language]}</h2>
        </div>
        <p className="muted">{section.intro[language]}</p>
      </div>
      {/* F3: adopt SlotImage for section photos; className applied to slot-image-frame */}
      <SlotImage
        content={content}
        slot={cropSlot}
        alt=""
        className="discover-section-photo"
      />
      <div className="discover-card-grid">
        {section.items.map((item, index) => (
          <DiscoverGuideCard
            index={index}
            item={item}
            key={item.id}
            language={language}
          />
        ))}
      </div>
    </section>
  );
}

function DiscoverGuideCard({
  index,
  item,
  language,
}: {
  index: number;
  item: DiscoverMedanGuideItem;
  language: Language;
}) {
  return (
    <article
      className={`discover-card ${item.imageUrl ? "has-image" : ""}`}
      key={item.id}
    >
      {item.imageUrl ? (
        <figure className="discover-card-image">
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="(max-width: 860px) calc(100vw - 48px), 420px"
          />
        </figure>
      ) : null}
      <div className="discover-card-body">
        <span className="discover-card-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h3 className="serif">{item.name[language]}</h3>
          <p className="muted">{item.note[language]}</p>
          {/* F6: map button when item.mapUrl is present */}
          {item.mapUrl ? (
            <a
              className="discover-card-map-link"
              href={item.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.name[language]} — ${language === "id" ? "buka peta" : "open map"}`}
            >
              <svg
                aria-hidden="true"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: "inline", marginRight: 4 }}
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {language === "id" ? "Lokasi" : "Location"}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
