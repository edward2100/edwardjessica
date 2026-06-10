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

  useEffect(() => {
    onChange(normalizePhoneNumber(effectiveCountryCode || "+62", localNumber));
  }, [effectiveCountryCode, localNumber, onChange]);

  return (
    <div className="form-field">
      <span>{label}</span>
      <div className="phone-input-grid">
        <select
          aria-label="Country code"
          className="select"
          value={countryCode}
          onChange={(event) => setCountryCode(event.target.value)}
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
            placeholder="+"
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
    </div>
  );
}
