import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { getPublishedContent } from "@/lib/data-store";
import { getSiteUrl } from "@/lib/env";
import { decodePublicLinkSlug } from "@/lib/guest-navigation";
import { getLanguagePreference } from "@/lib/language-preference-server";
import { resolvePublicLinkSlug, toLinkGuestContent } from "@/lib/rsvp";

// DL-8: short root path for any ENABLED public link type, equal to its code
// lowercased (FAMILY-AND-FRIENDS -> /family-and-friends). Static routes
// (/admin, /api, /invite, /family, /overseas, /jessmarried, /go, ...) and
// public files always win over this dynamic segment. Personal invitation
// codes are never resolved here; those stay at /invite/<CODE>.
// SF-2: a link's custom address (e.g. /JESSmarriED) is matched first, exactly
// and case-sensitively; any other segment keeps the code match above.
export const dynamic = "force-dynamic";

// One published-content read per request, shared by metadata and page.
const getContent = cache(getPublishedContent);

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
  if (!decodePublicLinkSlug(slug)) return {};
  const content = await getContent();
  const siteUrl = getSiteUrl();
  const ogImageUrl = content.images?.ogImage
    ? new URL(content.images.ogImage, siteUrl).toString()
    : content.heroImageUrl
      ? new URL(content.heroImageUrl, siteUrl).toString()
      : `${siteUrl}/assets/wedding-hero-placeholder.png`;
  const title = "The Wedding of Edward & Jessica";
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
  if (!inviteType) notFound();
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
