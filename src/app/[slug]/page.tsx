import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import {
  getInvitationByCode,
  getPublishedContent,
  recordInviteOpen,
} from "@/lib/data-store";
import { getSiteUrl } from "@/lib/env";
import { decodePublicLinkSlug } from "@/lib/guest-navigation";
import { getLanguagePreference } from "@/lib/language-preference-server";
import {
  getEffectiveRsvpDeadline,
  resolvePersonalLinkSlug,
  resolvePublicLinkSlug,
  toGuestContent,
  toLinkGuestContent,
  toPersonalInvite,
} from "@/lib/rsvp";

// DL-8: short root path for any ENABLED public link type, equal to its code
// lowercased (FAMILY-AND-FRIENDS -> /family-and-friends). Static routes
// (/admin, /api, /invite, /family, /overseas, /jessmarried, /go, ...) and
// public files always win over this dynamic segment. Personal invitation
// codes are never resolved here; those stay at /invite/<CODE>. PL-1: except
// a simple link's personal links (/JESSmarriED-2295A3FMJQWX), matched last.
// SF-2: a link's custom address (e.g. /JESSmarriED) is matched first, exactly
// and case-sensitively; any other segment keeps the code match above.
export const dynamic = "force-dynamic";

// One published-content read per request, shared by metadata and page.
const getContent = cache(getPublishedContent);
// PL-1: likewise one read of a personal link's invitation.
const getPersonalInvitation = cache(getInvitationByCode);

// Only a clean single segment (same rule as publicLinkShortPath) can be a
// link's address. Anything else (/favicon.ico, /robots.txt, bot probes) gets
// "" and 404s before any database read.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // SF-2: link pages share one title/description, so a custom address gets
  // the same metadata as a code path.
  const decodedSlug = decodePublicLinkSlug(slug);
  if (!decodedSlug) return {};
  const content = await getContent();
  const siteUrl = getSiteUrl();
  const ogImageUrl = content.images?.ogImage
    ? new URL(content.images.ogImage, siteUrl).toString()
    : content.heroImageUrl
      ? new URL(content.heroImageUrl, siteUrl).toString()
      : `${siteUrl}/assets/wedding-hero-placeholder.png`;
  // PL-1: a personal link's preview names the guest, as /invite/<code> does.
  const personal = resolvePublicLinkSlug(content, decodedSlug)
    ? undefined
    : resolvePersonalLinkSlug(content, decodedSlug);
  const invitation = personal ? await getPersonalInvitation(personal.code) : null;
  const title = invitation
    ? `The Wedding of Edward & Jessica — ${invitation.groupName}`
    : "The Wedding of Edward & Jessica";
  const description = "12 December 2026 · Medan — You are warmly invited.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: ogImageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decodedSlug = decodePublicLinkSlug(slug);
  if (!decodedSlug) notFound();
  const content = await getContent();
  const inviteType = resolvePublicLinkSlug(content, decodedSlug);
  if (inviteType) {
    const initialLanguage = await getLanguagePreference();
    // DL-7: the link's own deadline; no other link codes in the payload.
    // SF-3: no events in the payload for a simple-form link.
    return (
      <SelfRegisterInvitePage
        content={toLinkGuestContent(content, inviteType)}
        inviteType={inviteType}
        initialLanguage={initialLanguage}
      />
    );
  }

  // PL-1: a personal link (/JESSmarriED-2295A3FMJQWX) on a simple-form link.
  const personal = resolvePersonalLinkSlug(content, decodedSlug);
  const invitation = personal ? await getPersonalInvitation(personal.code) : null;
  if (!personal || !invitation) notFound();
  await recordInviteOpen(invitation.code);
  // EN-1: like every guest page, these links open in the site's default
  // language (English) unless the guest chose one (EN/ID toggle).
  const initialLanguage = await getLanguagePreference();
  return (
    <SelfRegisterInvitePage
      content={toGuestContent(
        content,
        getEffectiveRsvpDeadline(content, { invitation, inviteType: personal.link }),
      )}
      inviteType={personal.link}
      // PL-2: name, party and answer only (no email, phone or notes).
      personal={toPersonalInvite(invitation)}
      initialLanguage={initialLanguage}
    />
  );
}
