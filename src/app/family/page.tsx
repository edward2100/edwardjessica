import { notFound } from "next/navigation";
import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { getPublishedContent } from "@/lib/data-store";
import { getPublicInviteTypeById } from "@/lib/rsvp";

export const dynamic = "force-dynamic";

export default async function Page() {
  const content = await getPublishedContent();
  const inviteType = getPublicInviteTypeById(content, "family");
  if (!inviteType) notFound();
  return <SelfRegisterInvitePage content={content} inviteType={inviteType} />;
}
