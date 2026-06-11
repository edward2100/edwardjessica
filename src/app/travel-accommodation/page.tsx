import type { Metadata } from "next";
import { TravelAccommodationPage } from "@/components/site/travel-accommodation-page";
import {
  getPublishedContent,
  getTravelPlanByInvitationId,
} from "@/lib/data-store";
import { getSiteUrl } from "@/lib/env";
import { resolveGuestFlowContext } from "@/lib/guest-flow";

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
  searchParams: Promise<{ code?: string; flow?: string }>;
}) {
  const params = await searchParams;
  const content = await getPublishedContent();
  const { invitation, normalizedCode, requestedFlow, codeFoundButWrongFlow } =
    await resolveGuestFlowContext(params, { expandedOnly: true });

  // B1: fetch existing travel plan for this invitation so the component can
  // show the submitted-state card when a plan already exists.
  const existingTravelPlan = invitation?.id
    ? await getTravelPlanByInvitationId(invitation.id)
    : null;

  return (
    <TravelAccommodationPage
      content={content}
      flow={requestedFlow}
      invitation={invitation}
      requestedCode={normalizedCode || undefined}
      codeFoundButWrongFlow={codeFoundButWrongFlow}
      existingTravelPlan={existingTravelPlan}
    />
  );
}
