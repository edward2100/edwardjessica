import { notFound } from "next/navigation";
import { InvitePage } from "@/components/site/invite-page";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import {
  getInvitationByCode,
  getPublishedContent,
  recordInviteOpen,
} from "@/lib/data-store";
import { findPublicInviteTypeByCode, normalizeInviteCode } from "@/lib/rsvp";
import type { InvitationGroup } from "@/lib/types";

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
    return (
      <SelfRegisterInvitePage content={content} inviteType={publicInviteType} />
    );
  }
  if (!invitation) notFound();
  await recordInviteOpen(normalizedCode);

  // E1-7: strip PII fields before serialising the invitation into the client component props.
  // email, phone, and privateNotes must not appear in the server-rendered HTML.
  // The OTP gate loses the email pre-fill — acceptable given the PII exposure risk.
  const safeInvitation: InvitationGroup = {
    id: invitation.id,
    code: invitation.code,
    greeting: invitation.greeting,
    groupName: invitation.groupName,
    maxGuests: invitation.maxGuests,
    side: invitation.side,
    source: invitation.source,
    flow: invitation.flow,
    eligibleEvents: invitation.eligibleEvents,
    openedAt: invitation.openedAt,
    rsvp: invitation.rsvp,
    guests: invitation.guests,
    // email, phone, and privateNotes intentionally omitted
  };

  return <InvitePage content={content} invitation={safeInvitation} />;
}
