"use client";

import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { copy } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export function EmailOtpGate({
  autoVerifySession = true,
  code,
  defaultEmail,
  language,
  onVerified,
}: {
  autoVerifySession?: boolean;
  code?: string;
  defaultEmail?: string;
  language: Language;
  onVerified: (email: string) => void;
}) {
  const c = copy[language];
  const [email, setEmail] = useState(defaultEmail || "");
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");
  const [devCode, setDevCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState<"send" | "verify" | "">("");

  useEffect(() => {
    if (!autoVerifySession) return;
    const query = code ? `?code=${encodeURIComponent(code)}` : "";
    fetch(`/api/guest-auth/status${query}`)
      .then((response) => response.json())
      .then((json: { verified?: boolean; email?: string }) => {
        if (json.verified && json.email) onVerified(json.email);
      })
      .catch(() => undefined);
  }, [autoVerifySession, code, onVerified]);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("send");
    setNotice("");
    setDevCode("");
    const response = await fetch("/api/guest-auth/send-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const json = (await response.json()) as {
      error?: string;
      devCode?: string;
    };
    setLoading("");
    if (!response.ok) {
      setNotice(json.error || c.unableToSaveRsvp);
      return;
    }
    setSent(true);
    setDevCode(json.devCode || "");
    setNotice(c.otpSent);
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("verify");
    setNotice("");
    const response = await fetch("/api/guest-auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, token, code }),
    });
    const json = (await response.json()) as { error?: string; email?: string };
    setLoading("");
    if (!response.ok || !json.email) {
      setNotice(json.error || c.unableToSaveRsvp);
      return;
    }
    setNotice(c.otpVerified);
    onVerified(json.email);
  }

  return (
    <div className="invite-panel">
      <p className="eyebrow">
        <ShieldCheck size={15} style={{ display: "inline", marginRight: 6 }} />
        {c.verifyEmailTitle}
      </p>
      <h3 className="serif" style={{ fontSize: "2rem", marginTop: 10 }}>
        {c.tellUsWhoIsComing}
      </h3>
      <p className="muted" style={{ marginTop: 12 }}>
        {code ? c.inviteEmailIntro : c.verifyEmailIntro}
      </p>
      <form onSubmit={sendCode} style={{ marginTop: 18 }}>
        <label className="form-field" htmlFor="guest-otp-email">
          <span>
            <Mail size={14} style={{ display: "inline", marginRight: 4 }} />
            {c.emailAddress}
          </span>
          <input
            className="input"
            id="guest-otp-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <button
          className="button button-muted"
          disabled={loading === "send"}
          type="submit"
          style={{ marginTop: 14 }}
        >
          {loading === "send" ? c.sendingCode : c.sendCode}
        </button>
      </form>

      {sent ? (
        <form onSubmit={verifyCode} style={{ marginTop: 18 }}>
          <label className="form-field" htmlFor="guest-otp-token">
            <span>{c.enterOtpCode}</span>
            <input
              className="input"
              id="guest-otp-token"
              inputMode="numeric"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
            />
          </label>
          <button
            className="button button-primary"
            disabled={loading === "verify"}
            type="submit"
            style={{ marginTop: 14 }}
          >
            {loading === "verify" ? c.verifyingCode : c.verifyCode}
          </button>
        </form>
      ) : null}

      {notice ? (
        <p className="muted" style={{ marginTop: 14 }}>
          {notice === c.otpVerified ? (
            <CheckCircle2
              size={16}
              style={{ display: "inline", marginRight: 6 }}
            />
          ) : null}
          {notice}
        </p>
      ) : null}
      {devCode ? (
        <p className="muted" style={{ marginTop: 8 }}>
          {c.devOtpHint.replace("{code}", devCode)}
        </p>
      ) : null}
    </div>
  );
}
