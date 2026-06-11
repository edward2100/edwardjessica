"use client";

import Image from "next/image";
import { useState } from "react";

// E2-7: URL is hardcoded until it moves into the content model.
// TODO: lift into WeddingContent so it can be updated in the admin panel.
const MAP_IMAGE_FALLBACK_URL =
  "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/medan-region-map.svg";

export function InvitationMapLink({
  mapsUrl,
  venueName,
  openMapLabel,
}: {
  mapsUrl: string;
  venueName: string;
  openMapLabel: string;
}) {
  // E2-7: hide the artwork gracefully if the asset cannot load.
  const [imageError, setImageError] = useState(false);

  return (
    <a
      className="invitation-map-link"
      href={mapsUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${venueName} in Google Maps`}
    >
      {!imageError ? (
        <span className="invitation-map-art" aria-hidden="true">
          <Image
            className="invitation-map-image"
            src={MAP_IMAGE_FALLBACK_URL}
            alt=""
            width={1200}
            height={675}
            unoptimized
            onError={() => setImageError(true)}
          />
        </span>
      ) : null}
      <span className="invitation-map-copy">
        <span>{venueName}</span>
        <small>{openMapLabel}</small>
      </span>
    </a>
  );
}
