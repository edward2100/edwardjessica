"use client";

import Image from "next/image";

const MAP_IMAGE_URL =
  "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/medan-region-map.svg";

export function InvitationMapLink({
  mapsUrl,
  venueName,
  openMapLabel
}: {
  mapsUrl: string;
  venueName: string;
  openMapLabel: string;
}) {
  return (
    <a
      className="invitation-map-link"
      href={mapsUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${venueName} in Google Maps`}
    >
      <span className="invitation-map-art" aria-hidden="true">
        <Image
          className="invitation-map-image"
          src={MAP_IMAGE_URL}
          alt=""
          width={1200}
          height={675}
          unoptimized
        />
      </span>
      <span className="invitation-map-copy">
        <span>{venueName}</span>
        <small>{openMapLabel}</small>
      </span>
    </a>
  );
}
