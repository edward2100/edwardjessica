"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import type { Language, PublicInviteFlow } from "@/lib/types";

type GuestMenuItem = {
  href: string;
  label: string;
};

const menuLabels = {
  en: {
    menu: "Menu",
    close: "Close menu",
    invitation: "Invitation",
    travel: "Travel & Accommodation",
    discover: "Discover Medan",
  },
  id: {
    menu: "Menu",
    close: "Tutup menu",
    invitation: "Undangan",
    travel: "Perjalanan & Akomodasi",
    discover: "Jelajahi Medan",
  },
} as const;

export function GuestMenu({
  discoverHref,
  flow,
  invitationHref,
  language,
  travelHref,
}: {
  discoverHref?: string;
  flow: PublicInviteFlow;
  invitationHref: string;
  language: Language;
  travelHref?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const labels = menuLabels[language];
  const items: GuestMenuItem[] = [
    {
      href: invitationHref,
      label: labels.invitation,
    },
  ];

  if (flow !== "generic") {
    items.push(
      {
        href: travelHref || invitationHref,
        label: labels.travel,
      },
      {
        href: discoverHref || invitationHref,
        label: labels.discover,
      },
    );
  }

  return (
    <nav className="guest-menu" aria-label={labels.menu}>
      <button
        className="guest-menu-button"
        type="button"
        aria-label={isOpen ? labels.close : labels.menu}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      {isOpen ? (
        <div className="guest-menu-panel">
          {items.map((item) => (
            <Link
              className="guest-menu-link"
              href={item.href as Route}
              key={item.label}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
