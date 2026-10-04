import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitePage } from "@/components/site/invite-page";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import {
  getInvitationByCode,
  getPublishedContent,
  recordInviteOpen,
} from "@/lib/data-store";
import { getSiteUrl } from "@/lib/env";
import {
  findPublicInviteTypeByCode,
  getEffectiveRsvpDeadline,
  normalizeInviteCode,
  toGuestContent,
  toGuestInvitation,
} from "@/lib/rsvp";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const normalizedCode = normalizeInviteCode(decodeURIComponent(code));
  const [content, invitation] = await Promise.all([
    getPublishedContent(),
    getInvitationByCode(normalizedCode),
  ]);
  const siteUrl = getSiteUrl();
  const ogImageUrl = content.images?.ogImage
    ? new URL(content.images.ogImage, siteUrl).toString()
    : content.heroImageUrl
      ? new URL(content.heroImageUrl, siteUrl).toString()
      : `${siteUrl}/assets/wedding-hero-placeholder.png`;

  // Private invite pages append the group greeting when available.
  const greeting = invitation?.greeting;
  const title = greeting
    ? `The Wedding of Edward & Jessica — ${greeting}`
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
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalizedCode = normalizeInviteCode(decodeURIComponent(code));
  const [content, invitation] = await Promise.all([
    getPublishedContent(),
    getInvitationByCode(normalizedCode),
  ]);

  const publicInviteType = findPublicInviteTypeByCode(content, normalizedCode);
  if (!invitation && publicInviteType) {
    // DL-7: public link -> that link's deadline; other link codes stripped.
    return (
      <SelfRegisterInvitePage
        content={toGuestContent(
          content,
          getEffectiveRsvpDeadline(content, { inviteType: publicInviteType }),
        )}
        inviteType={publicInviteType}
      />
    );
  }
  if (!invitation) notFound();
  await recordInviteOpen(normalizedCode);

  // E1-7: strip PII fields before serialising the invitation into the client component props.
  // email, phone, and privateNotes must not appear in the server-rendered HTML.
  // The OTP gate loses the email pre-fill — acceptable given the PII exposure risk.
  // CL-11: the allowlist is shared with /discover-medan and /travel-accommodation.
  const safeInvitation = toGuestInvitation(invitation);

  // DL-7: personal invite -> the invitation's effective deadline.
  return (
    <InvitePage
      content={toGuestContent(
        content,
        getEffectiveRsvpDeadline(content, { invitation }),
      )}
      invitation={safeInvitation}
    />
  );
}
