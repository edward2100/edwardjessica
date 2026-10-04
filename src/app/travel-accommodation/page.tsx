import type { Metadata } from "next";
import { TravelAccommodationPage } from "@/components/site/travel-accommodation-page";
import {
  getPublishedContent,
  getTravelPlanByInvitationId,
} from "@/lib/data-store";
import { getSiteUrl } from "@/lib/env";
import {
  isExpandedGuestFlow,
  resolveGuestFlowContext,
} from "@/lib/guest-flow";
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
  const description = "12 December 2026 · Medan — Travel & Accommodation.";

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
  // enabled public link type is honoured; anything else is ignored. Its flow
  // is used when it is a travel flow (overseas/family).
  const linkType =
    typeof params.link === "string"
      ? findPublicInviteTypeByCode(content, params.link)
      : undefined;
  const { invitation, normalizedCode, requestedFlow, codeFoundButWrongFlow } =
    await resolveGuestFlowContext(
      {
        code: params.code,
        flow:
          linkType && isExpandedGuestFlow(linkType.flow)
            ? linkType.flow
            : params.flow,
      },
      { expandedOnly: true },
    );
  // DL-7: a resolved invitation uses its own effective deadline; otherwise
  // the link's (or the main) deadline.
  const effectiveDeadline = invitation
    ? getEffectiveRsvpDeadline(content, { invitation })
    : getEffectiveRsvpDeadline(content, { inviteType: linkType });

  // B1: fetch existing travel plan for this invitation so the component can
  // show the submitted-state card when a plan already exists.
  const existingTravelPlan = invitation?.id
    ? await getTravelPlanByInvitationId(invitation.id)
    : null;

  return (
    <TravelAccommodationPage
      content={toGuestContent(content, effectiveDeadline)}
      flow={requestedFlow}
      // CL-11: allowlisted fields only (no email / phone / privateNotes).
      invitation={invitation ? toGuestInvitation(invitation) : null}
      requestedCode={normalizedCode || undefined}
      codeFoundButWrongFlow={codeFoundButWrongFlow}
      existingTravelPlan={existingTravelPlan}
      linkCode={invitation ? undefined : customPublicLinkCode(linkType)}
    />
  );
}
