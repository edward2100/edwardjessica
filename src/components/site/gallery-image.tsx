"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * GalleryImage — a single "Our Moments" gallery photo that degrades
 * gracefully. If the underlying file 404s (e.g. removed from storage), the
 * whole figure is removed from the layout instead of rendering the browser's
 * broken-image placeholder. Alt is intentionally empty: these are decorative
 * gallery photos, so screen readers skip them rather than announcing a filename.
 */
export function GalleryImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="gallery-item">
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 860px) 100vw, 33vw"
        unoptimized
        onError={() => setFailed(true)}
      />
    </figure>
  );
}
