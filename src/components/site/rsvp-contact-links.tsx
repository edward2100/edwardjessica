import { Mail, MessageCircle } from "lucide-react";
import { copy } from "@/lib/i18n";
import { normalizeRsvpContact } from "@/lib/rsvp";
import type { Language, RsvpContact } from "@/lib/types";

/**
 * CL-3: "Message us on WhatsApp" / "Email us" buttons for closed RSVP states
 * (personal invite, public link, travel page). Renders the anchors only, so
 * callers place them inside their own action row; renders nothing when no
 * valid contact is set. The value is re-validated here as defence in depth.
 */
export function RsvpContactLinks({
  contact,
  language,
}: {
  contact?: RsvpContact;
  language: Language;
}) {
  const { whatsappUrl, email } = normalizeRsvpContact(contact);
  if (!whatsappUrl && !email) return null;
  const c = copy[language];
  return (
    <>
      {whatsappUrl ? (
        <a
          className="button button-muted"
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={17} />
          {c.contactWhatsApp}
        </a>
      ) : null}
      {email ? (
        <a className="button button-muted" href={`mailto:${email}`}>
          <Mail size={17} />
          {c.contactEmail}
        </a>
      ) : null}
    </>
  );
}
