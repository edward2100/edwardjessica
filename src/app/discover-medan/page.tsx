import type { Metadata } from "next";
import { DiscoverMedanPage } from "@/components/site/discover-medan-page";
import { getPublishedContent } from "@/lib/data-store";
import { getSiteUrl } from "@/lib/env";
import { resolveGuestFlowContext } from "@/lib/guest-flow";
import { customPublicLinkCode } from "@/lib/guest-navigation";
import {
  findPublicInviteTypeByCode,
  getEffectiveRsvpDeadline,
  toGuestContent,
  toGuestInvitation,
} from "@/lib/rsvp";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublishedContent();
  const siteUrl = getSiteUrl();
  const ogImageUrl = content.images?.ogImage
    ? new URL(content.images.ogImage, siteUrl).toString()
    : content.heroImageUrl
      ? new URL(content.heroImageUrl, siteUrl).toString()
      : `${siteUrl}/assets/wedding-hero-placeholder.png`;
  const title = "The Wedding of Edward & Jessica";
  const description = "12 December 2026 · Medan — Discover Medan.";

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
  searchParams,
}: {
  searchParams: Promise<{ code?: string; flow?: string; link?: string }>;
}) {
  const params = await searchParams;
  const content = await getPublishedContent();
  // DL-9: `link` keeps a custom public link's identity across pages. Only an
  // enabled public link type is honoured; anything else is ignored.
  const linkType =
    typeof params.link === "string"
      ? findPublicInviteTypeByCode(content, params.link)
      : undefined;
  const { invitation, requestedFlow } = await resolveGuestFlowContext({
    code: params.code,
    flow: linkType?.flow ?? params.flow,
  });
  // DL-7: invitation deadline when resolved, else the link's / main one.
  const effectiveDeadline = invitation
    ? getEffectiveRsvpDeadline(content, { invitation })
    : getEffectiveRsvpDeadline(content, { inviteType: linkType });

  return (
    <DiscoverMedanPage
      content={toGuestContent(content, effectiveDeadline)}
      flow={requestedFlow}
      // CL-11: allowlisted fields only (no email / phone / privateNotes).
      invitation={invitation ? toGuestInvitation(invitation) : null}
      linkCode={invitation ? undefined : customPublicLinkCode(linkType)}
    />
  );
}
