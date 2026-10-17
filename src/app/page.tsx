import type { Metadata } from "next";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { getPublishedContent } from "@/lib/data-store";
import { getSiteUrl } from "@/lib/env";
import { getLanguagePreference } from "@/lib/language-preference-server";
import { getDefaultPublicInviteType, toLinkGuestContent } from "@/lib/rsvp";

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

export default async function Page() {
  const content = await getPublishedContent();
  const inviteType = getDefaultPublicInviteType(content);
  const initialLanguage = await getLanguagePreference();
  // DL-7: effective (link) deadline, no other link codes in the payload.
  // SF-3: no events in the payload if this link uses the simple form.
  return (
    <SelfRegisterInvitePage
      content={toLinkGuestContent(content, inviteType)}
      inviteType={inviteType}
      initialLanguage={initialLanguage}
    />
  );
}
