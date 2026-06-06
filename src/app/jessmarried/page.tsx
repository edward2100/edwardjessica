import { SelfRegisterInvitePage } from "@/components/site/self-register-invite-page";
import { getPublishedContent } from "@/lib/data-store";
import { GENERIC_INVITE_CODE } from "@/lib/rsvp";

export default async function Page() {
  const content = await getPublishedContent();
  return <SelfRegisterInvitePage content={content} accessCode={GENERIC_INVITE_CODE} />;
}
