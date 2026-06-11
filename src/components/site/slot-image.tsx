import Image from "next/image";
import type { ImageCropSlot, WeddingContent } from "@/lib/types";
import {
  frameAspect,
  imageCropStyleVars,
  normalizeImageCrop,
} from "@/lib/image-crop";

/**
 * SlotImage — shared guest-page image component.
 *
 * Source resolution rule (per architecture decision 2):
 *   mobile viewport  → mobileImages[slot] ?? images[slot] ?? legacy *ImageUrl field
 *   desktop viewport → images[slot] ?? mobileImages[slot] ?? legacy *ImageUrl field
 *
 * Responsive switching is achieved with two <Image> tags toggled by Tailwind
 * md: breakpoint classes (CSS-only, no JS matchMedia).
 *
 * The frame div uses the slot's imageFrames ratio from frameAspect().
 * hero is full-bleed (caller handles sizing); all other slots are wrapped.
 */

type SlotImageContent = Pick<
  WeddingContent,
  | "imageCrops"
  | "images"
  | "mobileImages"
  | "imageFrames"
  | "heroImageUrl"
  | "invitationImageUrl"
  | "storyImageUrl"
  | "travelHeroImageUrl"
  | "travelAirportImageUrl"
  | "travelAccommodationImageUrl"
  | "travelFormImageUrl"
  | "discoverHeroImageUrl"
  | "discoverIntroImageUrl"
  | "discoverFoodImageUrl"
  | "discoverSupperImageUrl"
  | "discoverCafeImageUrl"
>;

// Partial: newer slots (e.g. discoverPlaces) live only in the images map and
// have no legacy *ImageUrl field.
const LEGACY_URL_MAP: Partial<
  Record<Exclude<ImageCropSlot, "hero">, keyof SlotImageContent>
> = {
  invitation: "invitationImageUrl",
  story: "storyImageUrl",
  travelHero: "travelHeroImageUrl",
  travelAirport: "travelAirportImageUrl",
  travelAccommodation: "travelAccommodationImageUrl",
  travelForm: "travelFormImageUrl",
  discoverHero: "discoverHeroImageUrl",
  discoverIntro: "discoverIntroImageUrl",
  discoverFood: "discoverFoodImageUrl",
  discoverSupper: "discoverSupperImageUrl",
  discoverCafe: "discoverCafeImageUrl",
};

function resolveUrl(
  content: SlotImageContent,
  slot: ImageCropSlot,
  preferMobile: boolean,
): string {
  const legacyKey =
    slot !== "hero"
      ? LEGACY_URL_MAP[slot as Exclude<ImageCropSlot, "hero">]
      : undefined;
  const legacyUrl =
    slot === "hero"
      ? content.heroImageUrl
      : legacyKey
        ? (content[legacyKey] as string | undefined)
        : undefined;
  const desktopUrl =
    (content.images?.[slot] as string | undefined) || legacyUrl || "";
  const mobileUrl =
    (content.mobileImages?.[slot] as string | undefined) || desktopUrl;

  return preferMobile ? mobileUrl : desktopUrl;
}

interface SlotImageProps {
  content: SlotImageContent;
  slot: ImageCropSlot;
  alt: string;
  className?: string;
  priority?: boolean;
}

/**
 * Renders a framed image for non-hero slots, or an un-framed full-fill image
 * for the hero slot (caller controls the hero wrapper).
 *
 * For non-hero slots the outer div carries the aspect-ratio and overflow:hidden.
 * Two <Image> tags handle the mobile/desktop swap via Tailwind md: classes.
 */
export function SlotImage({
  content,
  slot,
  alt,
  className,
  priority = false,
}: SlotImageProps) {
  const cropVars = imageCropStyleVars(content, slot);

  // A focal-point zoom magnifies 1/zoom of the source across the full frame,
  // so the optimizer must serve zoom-times more pixels to stay sharp.
  const crop = normalizeImageCrop(content.imageCrops?.[slot]);
  const desktopSizes = `${Math.ceil(100 * crop.desktop.zoom)}vw`;
  const mobileSizes = `${Math.ceil(100 * crop.mobile.zoom)}vw`;

  // Desktop URL (images[slot] ?? legacy field)
  const desktopSrc = resolveUrl(content, slot, false);
  // Mobile URL (mobileImages[slot] ?? desktop URL)
  const mobileSrc = resolveUrl(content, slot, true);

  // No image set for this slot (e.g. an optional section photo not yet
  // uploaded) — render nothing rather than a broken <Image>.
  if (!desktopSrc) return null;

  // Full-bleed hero slots fill their section (caller-controlled); every other
  // slot is wrapped in an aspect-ratio frame.
  const isHeroSlot =
    slot === "hero" || slot === "travelHero" || slot === "discoverHero";
  const aspectRatio = isHeroSlot ? undefined : frameAspect(content, slot);

  const imageStyle = {
    ...cropVars,
    objectFit: "cover" as const,
    objectPosition: "var(--image-position-desktop, center)",
    transform: "scale(var(--image-scale-desktop, 1))",
    transformOrigin:
      "var(--image-origin-desktop, var(--image-position-desktop, center))",
  };

  // Both viewport images always render (CSS-only swap) — inline styles can't
  // switch crop vars per viewport, so a single tag would pin the desktop crop
  // even on phones. Identical sources resolve to one network fetch.
  // For hero slots: just return the Image elements; caller wraps them
  if (isHeroSlot) {
    return (
      <>
        {/* Mobile image — hidden on md+ */}
        <Image
          src={mobileSrc}
          alt={alt}
          fill
          priority={priority}
          quality={100}
          sizes={mobileSizes}
          style={{
            ...imageStyle,
            objectPosition: "var(--image-position-mobile, var(--image-position-desktop, center))",
            transform: "scale(var(--image-scale-mobile, var(--image-scale-desktop, 1)))",
            transformOrigin:
              "var(--image-origin-mobile, var(--image-origin-desktop, var(--image-position-desktop, center)))",
          }}
          className={`md:hidden ${className ?? ""}`}
        />
        {/* Desktop image — hidden below md */}
        <Image
          src={desktopSrc}
          alt={alt}
          fill
          priority={priority}
          quality={100}
          sizes={desktopSizes}
          style={imageStyle}
          className={`hidden md:block ${className ?? ""}`}
        />
      </>
    );
  }

  // Non-hero: wrap in a frame div with the computed aspect-ratio
  return (
    <div
      className={`slot-image-frame ${className ?? ""}`}
      style={{ aspectRatio, position: "relative", overflow: "hidden" }}
    >
      {/* Mobile image — visible below md */}
      <Image
        src={mobileSrc}
        alt={alt}
        fill
        priority={priority}
        quality={100}
        sizes={mobileSizes}
        style={{
          ...imageStyle,
          objectPosition:
            "var(--image-position-mobile, var(--image-position-desktop, center))",
          transform:
            "scale(var(--image-scale-mobile, var(--image-scale-desktop, 1)))",
          transformOrigin:
            "var(--image-origin-mobile, var(--image-origin-desktop, var(--image-position-desktop, center)))",
        }}
        className="md:hidden"
      />
      {/* Desktop image — visible at md+ */}
      <Image
        src={desktopSrc}
        alt={alt}
        fill
        priority={priority}
        quality={100}
        sizes={desktopSizes}
        style={imageStyle}
        className="hidden md:block"
      />
    </div>
  );
}
