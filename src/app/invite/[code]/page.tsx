import { notFound } from "next/navigation";
import { InvitePage } from "@/components/site/invite-page";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { getInvitationByCode, getPublishedContent, recordInviteOpen } from "@/lib/data-store";
import { isGenericInviteCode, normalizeInviteCode } from "@/lib/rsvp";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalizedCode = normalizeInviteCode(decodeURIComponent(code));
  const [content, invitation] = await Promise.all([
    getPublishedContent(),
    getInvitationByCode(normalizedCode)
  ]);

  if (!invitation && isGenericInviteCode(normalizedCode)) {
    return <SelfRegisterInvitePage content={content} accessCode={normalizedCode} />;
  }
  if (!invitation) notFound();
  await recordInviteOpen(normalizedCode);

  return <InvitePage content={content} invitation={invitation} />;
}
