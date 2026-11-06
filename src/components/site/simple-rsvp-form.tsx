"use client";

import { Check, Clock, MapPin, PencilLine, Send } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { LateRsvpNotice } from "@/components/site/late-rsvp-notice";
import { PhoneCountryInput } from "@/components/site/phone-country-input";
import { RsvpContactLinks } from "@/components/site/rsvp-contact-links";
import { copy, guestNameText, simpleReceivedText } from "@/lib/i18n";
import {
  firstNameOf,
  GUEST_NAME_MAX_LENGTH,
  getRsvpWindow,
  normalizeRsvpContact,
  personalRsvpSchema,
  SIMPLE_DIETARY_MAX_LENGTH,
  simpleRsvpSchema,
} from "@/lib/rsvp";
import type {
  Language,
  PersonalInvite,
  PublicInviteType,
  WeddingContent,
} from "@/lib/types";

/** SF-3: what the simple form's success screen shows. */
export type SimpleRsvpOutcome =
  | {
      kind: "saved";
      firstName: string;
      attending: boolean;
      guestCount: number;
      /** LR-4: saved in the late window. */
      late: boolean;
    }
  | { kind: "existing"; firstName: string }
  /** PL-6: a personal link's saved answer (changeable on the page). */
  | { kind: "personal"; invite: PersonalInvite; late: boolean };

// PL-4: "guest-2" is the second person's name field.
type SimpleField =
  | "name"
  | "phone"
  | "email"
  | "attending"
  | "guestCount"
  | `guest-${number}`;

// SF-3: the first invalid field (in page order) gets focus.
function fieldId(field: SimpleField) {
  if (field.startsWith("guest-")) return `simple-${field}`;
  const ids: Record<string, string> = {
    name: "simple-name",
    phone: "simple-phone",
    email: "simple-email",
    attending: "simple-attending-yes",
    guestCount: "simple-count",
  };
  return ids[field];
}

// PL-4/PL-6: one name per possible person; a personal link's are prefilled.
function startingGuestNames(personal: PersonalInvite | undefined, limit: number) {
  return Array.from({ length: limit }, (_, index) => personal?.guestNames[index] ?? "");
}

/**
 * SF-3: the simple RSVP form (no email code): name, WhatsApp, email, yes/no,
 * number of people (PL-4: with a name for each) and an optional dietary
 * note. "Yes" is the dinner reception only; the server decides that, the
 * form never names events. PL-6: on a personal link the names come prefilled
 * from the invitation, there is no name or WhatsApp field, and the email is
 * optional (for a confirmation only).
 */
export function SimpleRsvpForm({
  content,
  inviteType,
  personal,
  language,
  late,
  onClosed,
  onSaved,
}: {
  content: WeddingContent;
  inviteType: PublicInviteType;
  /** PL-6: the personal link's invitation, when the page is one. */
  personal?: PersonalInvite;
  language: Language;
  /** LR-4: the late window is open (adds the late notice). */
  late: boolean;
  /** CL-5: called when RSVP closes (server 403 or the guest's own clock). */
  onClosed: () => void;
  onSaved: (outcome: SimpleRsvpOutcome) => void;
}) {
  const c = copy[language];
  const maxGuests = Math.min(
    10,
    Math.max(1, (personal ? personal.maxGuests : inviteType.maxGuests) || 1),
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // PL-6: a personal link starts from its saved answer, else the full party.
  const [attending, setAttending] = useState<boolean | null>(
    personal?.status === "attending"
      ? true
      : personal?.status === "declined"
        ? false
        : null,
  );
  const [guestCount, setGuestCount] = useState(
    personal
      ? Math.min(
          maxGuests,
          personal.status === "attending" ? personal.guestNames.length : maxGuests,
        )
      : 1,
  );
  const [guestNames, setGuestNames] = useState(() =>
    startingGuestNames(personal, maxGuests),
  );
  const [dietary, setDietary] = useState(personal?.dietary ?? "");
  const [website, setWebsite] = useState("");
  // Errors show after the first Send and then follow the fields as they change.
  const [showErrors, setShowErrors] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  // CL-5: checked on every render, so a deadline that passes on the guest's
  // own clock while the form is open is noticed on the next keystroke.
  const closed = getRsvpWindow(content.rsvpDeadline, content) === "closed";
  // PL-4: guest 1 is the name field on the link; a personal link asks for all.
  const firstNameField = personal ? 0 : 1;
  const errorText: Record<string, string> = {
    name: c.simpleErrorName,
    phone: c.simpleErrorPhone,
    email: c.simpleErrorEmail,
    attending: c.simpleErrorAttending,
    guestCount: c.simpleErrorCount,
  };
  const fieldOrder: SimpleField[] = [
    ...(personal ? [] : (["name", "phone", "email"] as SimpleField[])),
    "attending",
    "guestCount",
    ...Array.from(
      { length: maxGuests },
      (_, index) => `guest-${index + 1}` as SimpleField,
    ),
    ...(personal ? (["email"] as SimpleField[]) : []),
  ];

  useEffect(() => {
    if (closed) onClosed();
  }, [closed, onClosed]);

  function setGuestName(index: number, value: string) {
    setGuestNames((names) => names.map((item, i) => (i === index ? value : item)));
  }

  function payload() {
    const count = attending ? guestCount : 1;
    if (personal) {
      return {
        code: personal.code,
        attending: attending ?? undefined,
        guestCount: count,
        guestNames: attending ? guestNames.slice(0, count) : [],
        dietary: attending ? dietary : undefined,
        email,
        website,
        language,
      };
    }
    return {
      accessCode: inviteType.code,
      name,
      phone,
      email,
      attending: attending ?? undefined,
      guestCount: count,
      // PL-4: everyone's name, the guest first (from the name field).
      guestNames: attending ? [name, ...guestNames.slice(1, count)] : undefined,
      dietary: attending ? dietary : undefined,
      website,
      language,
    };
  }

  // SF-3: the server's own rules (simpleRsvpSchema / personalRsvpSchema), in
  // the guest's language.
  function findErrors() {
    const result = personal
      ? personalRsvpSchema(maxGuests).safeParse(payload())
      : simpleRsvpSchema(maxGuests).safeParse(payload());
    const found: Partial<Record<SimpleField, string>> = {};
    if (result.success) return found;
    for (const issue of result.error.issues) {
      const [key, index] = issue.path;
      if (key === "guestNames" && typeof index === "number") {
        const field = `guest-${index + 1}` as SimpleField;
        found[field] ??= guestNameText(c.simpleErrorGuestName, index + 1);
        continue;
      }
      const field = String(key) as SimpleField;
      if (field in errorText && !found[field]) found[field] = errorText[field];
    }
    return found;
  }

  const errors = showErrors ? findErrors() : {};

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // CL-5: closed by the guest's own clock — same switch as a 403.
    if (closed) {
      onClosed();
      return;
    }
    setNotice("");
    const found = findErrors();
    const firstInvalid = fieldOrder.find((field) => found[field]);
    if (firstInvalid) {
      setShowErrors(true);
      document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        personal ? "/api/rsvp/personal" : "/api/rsvp/simple",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload()),
        },
      );
      const json = (await response.json()) as {
        ok?: boolean;
        existing?: boolean;
        firstName?: string;
        status?: "attending" | "declined";
        guestCount?: number;
        invite?: PersonalInvite;
        late?: boolean;
        error?: string;
      };
      setLoading(false);
      // CL-5: 403 = RSVP closed; the parent switches to the closed card.
      if (response.status === 403) {
        setNotice(c.deadlineClosed);
        onClosed();
        return;
      }
      if (!response.ok || !json.ok) {
        setNotice(
          language === "id"
            ? c.unableToSaveRsvp
            : json.error || c.unableToSaveRsvp,
        );
        return;
      }
      if (personal) {
        onSaved({
          kind: "personal",
          invite: json.invite ?? personal,
          late: json.late === true,
        });
        return;
      }
      const firstName = json.firstName || firstNameOf(name);
      if (json.existing) {
        onSaved({ kind: "existing", firstName });
        return;
      }
      onSaved({
        kind: "saved",
        firstName,
        attending: json.status === "attending",
        guestCount: json.guestCount ?? 1,
        late: json.late === true,
      });
    } catch {
      setLoading(false);
      setNotice(
        language === "id"
          ? "Terjadi kesalahan jaringan. Mohon coba lagi."
          : "A network error occurred. Please try again.",
      );
    }
  }

  function chooseButtonClass(selected: boolean) {
    return `button ${selected ? "button-brown" : "button-muted"}`;
  }

  return (
    <form className="invite-panel" noValidate onSubmit={submit}>
      <p className="eyebrow">{c.registerRsvp}</p>
      <h3 className="serif" style={{ fontSize: "2rem", marginTop: 10 }}>
        {c.simpleFormTitle}
      </h3>
      {/* LR-4: "Late RSVP · Our RSVP date was …" */}
      {late ? (
        <LateRsvpNotice
          deadlineIso={content.rsvpDeadline}
          language={language}
          timeZone={content.timezone}
        />
      ) : null}

      {/* PL-6: a personal link already knows who is invited. */}
      {personal ? null : (
        <>
          <div style={{ marginTop: 18 }}>
            <label className="form-field" htmlFor="simple-name">
              <span>{c.yourName}</span>
              <input
                className="input"
                id="simple-name"
                autoComplete="name"
                maxLength={GUEST_NAME_MAX_LENGTH}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "simple-name-error" : undefined}
                required
              />
            </label>
            <FieldError id="simple-name-error" message={errors.name} />
          </div>

          <div style={{ marginTop: 14 }}>
            <PhoneCountryInput
              id="simple-phone"
              label={c.simpleWhatsApp}
              labelId="simple-phone-label"
              invalid={Boolean(errors.phone)}
              describedBy={errors.phone ? "simple-phone-error" : undefined}
              onChange={setPhone}
              required
              value={phone}
            />
            <FieldError id="simple-phone-error" message={errors.phone} />
          </div>

          <div style={{ marginTop: 14 }}>
            <EmailField
              label={c.emailAddress}
              value={email}
              onChange={setEmail}
              error={errors.email}
              required
            />
          </div>
        </>
      )}

      <div style={{ marginTop: 18 }}>
        <div
          className="form-field"
          role="group"
          aria-labelledby="simple-attending-label"
          aria-describedby={
            errors.attending ? "simple-attending-error" : undefined
          }
        >
          <span id="simple-attending-label">{c.simpleWillYouAttend}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              className={chooseButtonClass(attending === true)}
              id="simple-attending-yes"
              type="button"
              aria-pressed={attending === true}
              onClick={() => setAttending(true)}
              style={{ flex: "1 1 180px" }}
            >
              {attending === true ? <Check size={17} aria-hidden="true" /> : null}
              {c.simpleYes}
            </button>
            <button
              className={chooseButtonClass(attending === false)}
              id="simple-attending-no"
              type="button"
              aria-pressed={attending === false}
              onClick={() => setAttending(false)}
              style={{ flex: "1 1 180px" }}
            >
              {attending === false ? <Check size={17} aria-hidden="true" /> : null}
              {c.simpleNo}
            </button>
          </div>
        </div>
        <FieldError id="simple-attending-error" message={errors.attending} />
      </div>

      {attending === true && maxGuests > 1 ? (
        <div style={{ marginTop: 14 }}>
          <label className="form-field" htmlFor="simple-count">
            <span>{personal ? c.personalGuestCount : c.simpleHowMany}</span>
            <select
              className="select"
              id="simple-count"
              value={guestCount}
              onChange={(event) => setGuestCount(Number(event.target.value))}
              aria-invalid={errors.guestCount ? true : undefined}
              aria-describedby={
                errors.guestCount ? "simple-count-error" : undefined
              }
            >
              {Array.from({ length: maxGuests }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
          </label>
          <FieldError id="simple-count-error" message={errors.guestCount} />
        </div>
      ) : null}

      {/* PL-4: a name for each person (guest 1 is the name field above on
          the link; a personal link lists everyone, prefilled). */}
      {attending === true
        ? Array.from({ length: guestCount }, (_, index) => index)
            .slice(firstNameField)
            .map((index) => {
              const field = `guest-${index + 1}` as SimpleField;
              const id = fieldId(field);
              return (
                <div key={field} style={{ marginTop: 14 }}>
                  <label className="form-field" htmlFor={id}>
                    <span>{guestNameText(c.simpleGuestName, index + 1)}</span>
                    <input
                      className="input"
                      id={id}
                      autoComplete="off"
                      maxLength={GUEST_NAME_MAX_LENGTH}
                      value={guestNames[index] ?? ""}
                      onChange={(event) => setGuestName(index, event.target.value)}
                      aria-invalid={errors[field] ? true : undefined}
                      aria-describedby={errors[field] ? `${id}-error` : undefined}
                      required
                    />
                  </label>
                  <FieldError id={`${id}-error`} message={errors[field]} />
                </div>
              );
            })
        : null}

      {attending === true ? (
        <div style={{ marginTop: 14 }}>
          <label className="form-field" htmlFor="simple-dietary">
            <span>{c.simpleDietary}</span>
            <input
              className="input"
              id="simple-dietary"
              maxLength={SIMPLE_DIETARY_MAX_LENGTH}
              placeholder={c.simpleDietaryPlaceholder}
              value={dietary}
              onChange={(event) => setDietary(event.target.value)}
            />
          </label>
        </div>
      ) : null}

      {/* PL-6: on a personal link the email is only for a confirmation. */}
      {personal && attending !== null ? (
        <div style={{ marginTop: 14 }}>
          <EmailField
            label={c.personalEmailOptional}
            value={email}
            onChange={setEmail}
            error={errors.email}
          />
        </div>
      ) : null}

      {/* SF-3: honeypot. Off-screen and hidden from screen readers; people
          never fill it, so the server ignores RSVPs that do. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-10000px",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label htmlFor="simple-website">Website</label>
        <input
          id="simple-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      {closed ? (
        <p className="muted" style={{ marginTop: 14 }}>
          {c.deadlineClosed}
        </p>
      ) : null}
      {notice ? (
        <p className="muted" role="status" style={{ marginTop: 12 }}>
          {notice}
        </p>
      ) : null}
      <button
        className="button rsvp-main-button"
        type="submit"
        disabled={closed || loading}
        style={{ marginTop: 22 }}
      >
        <Send size={17} />
        {loading ? c.saving : c.saveRsvp}
      </button>
    </form>
  );
}

function EmailField({
  label,
  value,
  onChange,
  error,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}) {
  return (
    <>
      <label className="form-field" htmlFor="simple-email">
        <span>{label}</span>
        <input
          className="input"
          id="simple-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "simple-email-error" : undefined}
          required={required}
        />
      </label>
      <FieldError id="simple-email-error" message={error} />
    </>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      className="form-error"
      id={id}
      role="alert"
      style={{
        marginTop: 6,
        color: "var(--gold-dark)",
        fontSize: "0.88rem",
        fontWeight: 700,
      }}
    >
      {message}
    </p>
  );
}

/**
 * SF-3: replaces the simple form once it is sent: thanks, the status, the
 * date and venue with a map link, and how to change it (WhatsApp). No
 * calendar button and no personal-invite link.
 */
export function SimpleRsvpSuccess({
  content,
  language,
  outcome,
  onChangeAnswer,
}: {
  content: WeddingContent;
  language: Language;
  outcome: SimpleRsvpOutcome;
  /** PL-6: reopens a personal link's form with the saved answer. */
  onChangeAnswer?: () => void;
}) {
  const c = copy[language];
  const contact = normalizeRsvpContact(content.rsvpContact);
  const hasWhatsApp = Boolean(contact.whatsappUrl);
  const hasContact = hasWhatsApp || Boolean(contact.email);
  // PL-6: a personal link's answer reads like a saved one, and is changed on
  // the page instead of by message.
  const personal = outcome.kind === "personal" ? outcome.invite : null;
  const saved =
    outcome.kind === "saved"
      ? outcome
      : outcome.kind === "personal"
        ? {
            attending: outcome.invite.status === "attending",
            guestCount: outcome.invite.guestNames.length,
            late: outcome.late,
          }
        : null;
  const thankName =
    outcome.kind === "personal" ? outcome.invite.displayName : outcome.firstName;
  const statusLine = !saved
    ? hasWhatsApp
      ? c.simpleExisting
      : c.simpleExistingNoWhatsApp
    : saved.attending
      ? simpleReceivedText(language, saved.guestCount)
      : c.simpleDeclined;

  return (
    <div
      className="invite-panel"
      style={{
        padding: "clamp(24px, 5vw, 44px)",
        display: "grid",
        gap: 20,
        textAlign: "center",
      }}
    >
      <div aria-hidden="true" style={{ fontSize: "2.2rem", lineHeight: 1 }}>
        ✦
      </div>

      <div>
        <h3
          className="serif"
          style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", lineHeight: 1.1 }}
        >
          {c.simpleThankYou.replace("{name}", thankName)}
        </h3>
        <p className="muted" style={{ marginTop: 10 }}>
          {statusLine}
        </p>
        {/* LR-4: received late; the couple will confirm the place. */}
        {saved?.attending && saved.late ? (
          <p className="late-rsvp-saved">
            <Clock size={15} aria-hidden="true" />
            {c.lateRsvpReceived}
          </p>
        ) : null}
      </div>

      {saved ? (
        <div
          style={{
            borderTop: "1px solid var(--line)",
            paddingTop: 16,
            display: "grid",
            gap: 6,
            justifyItems: "center",
          }}
        >
          {/* On a narrow phone the line breaks after the day, never inside
              the date. */}
          <p className="serif" style={{ fontSize: "1.35rem", lineHeight: 1.25 }}>
            {c.weddingDay},{" "}
            <span style={{ whiteSpace: "nowrap" }}>{c.weddingDate}</span>
          </p>
          <p className="muted">
            {c.weddingVenueName} · {c.weddingVenueCity}
          </p>
          {content.venue.mapsUrl ? (
            <a
              className="button button-muted"
              href={content.venue.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 8 }}
            >
              <MapPin size={17} />
              {c.openMap}
            </a>
          ) : null}
        </div>
      ) : null}

      {saved || hasContact ? (
        <div
          style={{
            borderTop: saved ? "1px solid var(--line)" : undefined,
            paddingTop: saved ? 16 : 0,
            display: "grid",
            gap: 12,
            justifyItems: "center",
          }}
        >
          {saved ? (
            <p className="muted">
              {personal
                ? c.personalChangeHere
                : hasWhatsApp
                  ? c.simpleChange
                  : c.simpleChangeNoWhatsApp}
            </p>
          ) : null}
          {personal && onChangeAnswer ? (
            <button
              className="button button-brown"
              type="button"
              onClick={onChangeAnswer}
            >
              <PencilLine size={17} aria-hidden="true" />
              {c.personalChange}
            </button>
          ) : null}
          {/* CL-3: WhatsApp / email buttons when a contact is set. */}
          {hasContact ? (
            <div className="rsvp-actions" style={{ justifyContent: "center" }}>
              <RsvpContactLinks
                contact={content.rsvpContact}
                language={language}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
