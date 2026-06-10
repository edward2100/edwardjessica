"use client";

import { Send } from "lucide-react";

export function FloatingRsvpButton({ label = "RSVP" }: { label?: string }) {
  function scrollToRsvp() {
    document
      .getElementById("rsvp")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button
      className="floating-rsvp-button"
      type="button"
      onClick={scrollToRsvp}
    >
      <Send size={15} />
      {label}
    </button>
  );
}
