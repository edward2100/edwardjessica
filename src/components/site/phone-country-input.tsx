"use client";

import { useEffect, useState } from "react";
import { normalizePhoneNumber } from "@/lib/rsvp";

const countryCodes = [
  { label: "+62 Indonesia", value: "+62" },
  { label: "+65 Singapore", value: "+65" },
  { label: "+60 Malaysia", value: "+60" },
  { label: "+61 Australia", value: "+61" },
  { label: "+852 Hong Kong", value: "+852" },
  { label: "+86 China", value: "+86" },
  { label: "+1 US / Canada", value: "+1" },
  { label: "+44 United Kingdom", value: "+44" },
  { label: "Other", value: "other" },
];

// E2-6: country code must be an optional leading "+" followed by 1–4 digits.
const COUNTRY_CODE_RE = /^\+?\d{1,4}$/;

export function PhoneCountryInput({
  id,
  label,
  onChange,
  required = false,
  value,
}: {
  id: string;
  label: string;
  onChange: (phone: string) => void;
  required?: boolean;
  value: string;
}) {
  const [countryCode, setCountryCode] = useState("+62");
  const [manualCountryCode, setManualCountryCode] = useState("");
  const [localNumber, setLocalNumber] = useState(value);

  const effectiveCountryCode =
    countryCode === "other" ? manualCountryCode : countryCode;

  // E2-6: derive validation error for the "Other" code field directly
  // (no useState needed — it is a function of countryCode + manualCountryCode).
  const countryCodeError =
    countryCode === "other" &&
    (!manualCountryCode || !COUNTRY_CODE_RE.test(manualCountryCode))
      ? "Invalid country code / Kode negara tidak valid (contoh: +1, +44)"
      : null;

  // E2-6: propagate phone value upward. When the country code is invalid,
  // emit an empty string so the parent treats it as "no phone".
  // C5: normalizePhoneNumber throws when the local number is empty after cleaning
  // (e.g. user cleared the field). Guard with try/catch — on throw, emit empty
  // string so the parent treats it as absent rather than crashing the React tree.
  useEffect(() => {
    if (countryCodeError) {
      onChange("");
      return;
    }
    try {
      onChange(normalizePhoneNumber(effectiveCountryCode, localNumber));
    } catch {
      onChange("");
    }
  }, [countryCodeError, effectiveCountryCode, localNumber, onChange]);

  return (
    <div className="form-field">
      <span>{label}</span>
      <div className="phone-input-grid">
        <select
          aria-label="Country code"
          className="select"
          value={countryCode}
          onChange={(event) => {
            setCountryCode(event.target.value);
          }}
        >
          {countryCodes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {countryCode === "other" ? (
          <input
            aria-label="Manual country code"
            className="input"
            placeholder="e.g. +1"
            value={manualCountryCode}
            onChange={(event) => setManualCountryCode(event.target.value)}
            required={required}
          />
        ) : null}
        <input
          className="input"
          id={id}
          inputMode="tel"
          value={localNumber}
          onChange={(event) => setLocalNumber(event.target.value)}
          required={required}
        />
      </div>
      {countryCodeError ? (
        <span className="form-error" role="alert">
          {countryCodeError}
        </span>
      ) : null}
    </div>
  );
}
