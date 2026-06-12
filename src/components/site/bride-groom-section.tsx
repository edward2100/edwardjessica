import { copy } from "@/lib/i18n";
import { frameAspect } from "@/lib/image-crop";
import type { BrideGroomFrame, ImageCropSlot, Language, WeddingContent } from "@/lib/types";
import { SlotImage } from "@/components/site/slot-image";

// Names are language-independent; parents carry localized titles
// (Mr./Mrs. in English, Bpk./Ibu in Indonesian).
const BRIDE_NAME = "Jessica Limierta";
const GROOM_NAME = "Edward Marco Moktar";
const BRIDE_PARENTS: Record<Language, readonly [string, string]> = {
  en: ["Mr. Hardwin Salim", "Mrs. Masria Ang"],
  id: ["Bpk. Hardwin Salim", "Ibu Masria Ang"],
};
const GROOM_PARENTS: Record<Language, readonly [string, string]> = {
  en: ["Mr. Brilian Moktar", "Mrs. Janice Jong"],
  id: ["Bpk. Brilian Moktar", "Ibu Janice Jong"],
};

/** Shape classes shared by every frame layer (outer wrapper, mat, photo frame).
 *  The side modifier mirrors the petal shape between the two cards. */
function frameClass(frame: BrideGroomFrame, side: "bride" | "groom") {
  return `bg-frame-shape bg-frame-${frame} bg-frame-${side}`;
}

function PortraitCard({
  content,
  slot,
  frameSide,
  name,
  relation,
  parents,
}: {
  content: WeddingContent;
  slot: ImageCropSlot;
  frameSide: "bride" | "groom";
  name: string;
  relation: string;
  parents: readonly [string, string];
}) {
  const frame = content.brideGroomFrame;
  const shape = frameClass(frame, frameSide);
  // Mirror SlotImage's desktop-source gate: portrait slots have no legacy
  // *ImageUrl field, so a portrait exists exactly when images[slot] is set.
  // SlotImage returns null otherwise — render the framed placeholder instead.
  const hasImage = Boolean(content.images?.[slot]);

  return (
    <article className="bride-groom-card">
      <div className={`bg-frame-outer ${shape}`}>
        <div className={`bg-frame-mat ${shape}`}>
          {hasImage ? (
            <SlotImage
              content={content}
              slot={slot}
              alt={name}
              className={shape}
            />
          ) : (
            // SlotImage renders null with no upload — show a framed placeholder
            // so the owner previews the layout before uploading a portrait.
            <div
              className={`slot-image-frame ${shape}`}
              style={{
                aspectRatio: frameAspect(content, slot),
                background: "var(--paper)",
              }}
            />
          )}
        </div>
      </div>
      <p className="bride-groom-name">{name}</p>
      <p className="eyebrow bride-groom-relation">{relation}</p>
      <div className="bride-groom-parents">
        <p>{parents[0]}</p>
        <p className="bride-groom-amp">&amp;</p>
        <p>{parents[1]}</p>
      </div>
    </article>
  );
}

export function BrideGroomSection({
  content,
  language,
}: {
  content: WeddingContent;
  language: Language;
}) {
  const c = copy[language];

  return (
    <section className="section">
      <div className="page-shell">
        <div className="centered-section-copy">
          <p className="eyebrow">{c.brideGroomEyebrow}</p>
          <h2 className="title serif">{c.brideGroomTitle}</h2>
        </div>

        <div className="bride-groom-grid">
          <PortraitCard
            content={content}
            slot="bridePortrait"
            frameSide="bride"
            name={BRIDE_NAME}
            relation={c.daughterOf}
            parents={BRIDE_PARENTS[language]}
          />
          <p className="bride-groom-ampersand serif">&amp;</p>
          <PortraitCard
            content={content}
            slot="groomPortrait"
            frameSide="groom"
            name={GROOM_NAME}
            relation={c.sonOf}
            parents={GROOM_PARENTS[language]}
          />
        </div>
      </div>
    </section>
  );
}
