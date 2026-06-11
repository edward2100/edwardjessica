"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * "Our Moments" gallery as an expanding-panels row: the active panel (hovered
 * on desktop, or tapped on touch) grows while the others shrink. Defaults to the
 * first panel expanded. Broken images (missing storage files) drop out cleanly.
 */
export function InteractiveGallery({
  assets,
}: {
  assets: { id: string; url: string }[];
}) {
  const [active, setActive] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const shown = assets.filter((asset) => !failed[asset.id]);
  if (!shown.length) return null;
  const activeIndex = Math.min(active, shown.length - 1);

  return (
    <div className="gallery-expand">
      {shown.map((asset, index) => (
        <figure
          key={asset.id}
          className={`gallery-item ${index === activeIndex ? "is-active" : ""}`}
          onClick={() => setActive(index)}
          onMouseEnter={() => setActive(index)}
          onFocus={() => setActive(index)}
          tabIndex={0}
          aria-label={`Gallery photo ${index + 1} of ${shown.length}`}
        >
          <Image
            src={asset.url}
            alt=""
            fill
            sizes="(max-width: 860px) 100vw, 60vw"
            unoptimized
            onError={() =>
              setFailed((prev) => ({ ...prev, [asset.id]: true }))
            }
          />
        </figure>
      ))}
    </div>
  );
}
