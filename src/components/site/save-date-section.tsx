"use client";

import { CalendarDays } from "lucide-react";
import { InvitationMapLink } from "@/components/site/invitation-map-link";
import type { WeddingContent } from "@/lib/types";

type SaveDateLabels = {
  saveTheDate: string;
  weddingDay: string;
  weddingDate: string;
  weddingVenueName: string;
  weddingVenueCity: string;
  openMap: string;
  addToCalendar: string;
};

export function SaveDateSection({
  content,
  labels
}: {
  content: WeddingContent;
  labels: SaveDateLabels;
}) {
  return (
    <section className="section save-date-section">
      <div className="page-shell">
        <div className="centered-section-copy">
          <p className="eyebrow">{labels.saveTheDate}</p>
          <div className="invitation-meta-line">
            <p className="invitation-day serif">{labels.weddingDay}</p>
            <p className="invitation-date serif">{labels.weddingDate}</p>
            <h3 className="invitation-venue serif">{labels.weddingVenueName}</h3>
            <p className="invitation-city serif">{labels.weddingVenueCity}</p>
            <InvitationMapLink mapsUrl={content.venue.mapsUrl} venueName={content.venue.name} openMapLabel={labels.openMap} />
            <a className="button button-muted save-date-calendar-button" href="/calendar.ics" download="edward-jessica-wedding.ics">
              <CalendarDays size={17} />
              {labels.addToCalendar}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
