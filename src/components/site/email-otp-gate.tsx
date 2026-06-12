"use client";

import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { copy } from "@/lib/i18n";
import type { Language } from "@/lib/types";

// Matches Supabase Auth's "minimum interval per user" (60s) — a shorter UI
// cooldown would let guests retry into a window the server silently rejects.
const RESEND_COOLDOWN_SECONDS = 60;

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
  const [loading, setLoading] = useState<"send" | "verify" | "resend" | "">("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Scroll into view and focus the code input when the code step appears
  useEffect(() => {
    if (!sent) return;
    const timeout = window.setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      codeInputRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(timeout);
  }, [sent]);

  // Countdown tick for the resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = window.setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendCooldown]);

  async function doSendOtp(isResend = false) {
    setLoading(isResend ? "resend" : "send");
    setNotice("");
    setDevCode("");
    try {
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
        // Honour 429 rate-limit with the server's error message
        setNotice(json.error || c.unableToSaveRsvp);
        if (response.status === 429) {
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
        }
        return;
      }
      setSent(true);
      setDevCode(json.devCode || "");
      setNotice(c.otpSent);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setLoading("");
      setNotice(
        language === "id"
          ? "Terjadi kesalahan jaringan. Mohon coba lagi."
          : "A network error occurred. Please try again.",
      );
    }
  }

  function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void doSendOtp(false);
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("verify");
    setNotice("");
    try {
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
    } catch {
      setLoading("");
      setNotice(
        language === "id"
          ? "Terjadi kesalahan jaringan. Mohon coba lagi."
          : "A network error occurred. Please try again.",
      );
    }
  }

  const resendLabel =
    resendCooldown > 0
      ? c.resendCodeIn.replace("{s}", String(resendCooldown))
      : c.resendCode;

  return (
    <div className="invite-panel" ref={containerRef}>
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
          /* Grey out once sent — the "Resend code" button below handles re-sends. */
          disabled={sent || loading === "send"}
          type="submit"
          style={{ marginTop: 14 }}
        >
          {loading === "send"
            ? c.sendingCode
            : sent
              ? c.codeSent
              : c.sendCode}
        </button>
      </form>

      {sent ? (
        <form onSubmit={verifyCode} style={{ marginTop: 18 }}>
          <label className="form-field" htmlFor="guest-otp-token">
            <span>{c.enterOtpCode}</span>
            <input
              autoFocus
              className="input"
              id="guest-otp-token"
              inputMode="numeric"
              ref={codeInputRef}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
            />
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button
              className="button button-primary"
              disabled={loading === "verify"}
              type="submit"
            >
              {loading === "verify" ? c.verifyingCode : c.verifyCode}
            </button>
            <button
              className="button button-muted"
              disabled={resendCooldown > 0 || loading === "resend"}
              type="button"
              onClick={() => void doSendOtp(true)}
            >
              {loading === "resend" ? c.sendingCode : resendLabel}
            </button>
          </div>
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
