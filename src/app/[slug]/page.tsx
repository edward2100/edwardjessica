import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { getPublishedContent } from "@/lib/data-store";
import { getSiteUrl } from "@/lib/env";
import { isPublicLinkSlug } from "@/lib/guest-navigation";
import {
  findPublicInviteTypeByCode,
  getEffectiveRsvpDeadline,
  normalizeInviteCode,
  toGuestContent,
} from "@/lib/rsvp";

// DL-8: short root path for any ENABLED public link type, equal to its code
// lowercased (FAMILY-AND-FRIENDS -> /family-and-friends). Static routes
// (/admin, /api, /invite, /family, /overseas, /jessmarried, /go, ...) and
// public files always win over this dynamic segment. Personal invitation
// codes are never resolved here; those stay at /invite/<CODE>.
export const dynamic = "force-dynamic";

// One published-content read per request, shared by metadata and page.
const getContent = cache(getPublishedContent);

// Only a clean single segment (same rule as publicLinkShortPath) can be a
// link's short path. Anything else (/favicon.ico, /robots.txt, bot probes)
// gets "" and 404s before any database read.
function slugToCode(slug: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return "";
  }
  return isPublicLinkSlug(decoded) ? normalizeInviteCode(decoded) : "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!slugToCode(slug)) return {};
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
  const code = slugToCode(slug);
  if (!code) notFound();
  const content = await getContent();
  const inviteType = findPublicInviteTypeByCode(content, code);
  if (!inviteType) notFound();
  // DL-7: the link's own deadline; no other link codes in the payload.
  return (
    <SelfRegisterInvitePage
      content={toGuestContent(
        content,
        getEffectiveRsvpDeadline(content, { inviteType }),
      )}
      inviteType={inviteType}
    />
  );
}
