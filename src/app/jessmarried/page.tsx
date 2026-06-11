import type { Metadata } from "next";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { getPublishedContent } from "@/lib/data-store";
import { getSiteUrl } from "@/lib/env";
import { getDefaultPublicInviteType } from "@/lib/rsvp";

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
  return (
    <SelfRegisterInvitePage
      content={content}
      inviteType={getDefaultPublicInviteType(content)}
    />
  );
}
