"use client";

import type { Language } from "@/lib/types";
import { languages } from "@/lib/i18n";

export function LanguageToggle({
  language,
  onChange,
  variant = "light"
}: {
  language: Language;
  onChange: (language: Language) => void;
  variant?: "light" | "dark";
}) {
  return (
    <div
      className="language-switch"
      style={
        variant === "dark"
          ? {
              borderColor: "var(--line)",
              background: "rgba(255,255,255,0.72)"
            }
          : undefined
      }
    >
      {languages.map((item) => (
        <button
          key={item.code}
          type="button"
          className={item.code === language ? "active" : ""}
          onClick={() => onChange(item.code)}
          style={variant === "dark" && item.code !== language ? { color: "var(--ink)" } : undefined}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
