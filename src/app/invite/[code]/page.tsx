import { notFound } from "next/navigation";
import { InvitePage } from "@/components/site/invite-page";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import {
  getInvitationByCode,
  getPublishedContent,
  recordInviteOpen,
} from "@/lib/data-store";
import { findPublicInviteTypeByCode, normalizeInviteCode } from "@/lib/rsvp";

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

  return <InvitePage content={content} invitation={invitation} />;
}
