import type {
  ImageCropSettings,
  ImageCropSlot,
  ImageFocalPoint,
  ImageFrameRatio,
  WeddingContent,
} from "@/lib/types";

export const defaultImageCrop: ImageCropSettings = {
  desktop: { x: 50, y: 50, zoom: 1 },
  mobile: { x: 50, y: 50, zoom: 1 },
};

export const imageCropSlots: ImageCropSlot[] = [
  "hero",
  "invitation",
  "story",
  "travelHero",
  "travelAirport",
  "travelAccommodation",
  "travelForm",
  "discoverHero",
  "discoverIntro",
  "discoverFood",
  "discoverSupper",
  "discoverCafe",
  "discoverPlaces",
  "bridePortrait",
  "groomPortrait",
];

function clampPercent(value: unknown, fallback: number) {
  const numberValue =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(100, Math.max(0, Math.round(numberValue)));
}

function clampZoom(value: unknown, fallback: number) {
  const numberValue =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(3, Math.max(1, Math.round(numberValue * 100) / 100));
}

export function normalizeImageFocal(
  focal: Partial<ImageFocalPoint> | null | undefined,
  fallback: ImageFocalPoint,
): ImageFocalPoint {
  return {
    x: clampPercent(focal?.x, fallback.x),
    y: clampPercent(focal?.y, fallback.y),
    zoom: clampZoom(focal?.zoom, fallback.zoom),
  };
}

export function normalizeImageCrop(
  crop: Partial<ImageCropSettings> | null | undefined,
): ImageCropSettings {
  return {
    desktop: normalizeImageFocal(crop?.desktop, defaultImageCrop.desktop),
    mobile: normalizeImageFocal(crop?.mobile, defaultImageCrop.mobile),
  };
}

export function normalizeImageCrops(
  crops: Partial<Record<ImageCropSlot, Partial<ImageCropSettings>>> | undefined,
) {
  return imageCropSlots.reduce<Partial<Record<ImageCropSlot, ImageCropSettings>>>(
    (normalized, slot) => {
      normalized[slot] = normalizeImageCrop(crops?.[slot]);
      return normalized;
    },
    {},
  );
}

export function imageCropPosition(
  crop: ImageCropSettings | undefined,
  viewport: keyof ImageCropSettings,
) {
  const normalized = normalizeImageCrop(crop);
  return `${normalized[viewport].x}% ${normalized[viewport].y}%`;
}

export function imageCropScale(
  crop: ImageCropSettings | undefined,
  viewport: keyof ImageCropSettings,
) {
  return normalizeImageCrop(crop)[viewport].zoom;
}

/** CSS aspect-ratio strings for each frame variant. */
export const FRAME_RATIOS: Record<ImageFrameRatio, string> = {
  square: "1 / 1",
  portrait: "4 / 5",
  landscape: "3 / 2",
};

/**
 * Per-slot default frame ratios that reproduce the current rendered aspect
 * for each slot so nothing changes visually until Edward picks a new ratio.
 * hero is excluded — it is always full-bleed with no frame.
 */
const SLOT_FRAME_DEFAULTS: Partial<Record<ImageCropSlot, ImageFrameRatio>> = {
  invitation: "landscape",
  story: "portrait",
  travelHero: "landscape",
  travelAirport: "landscape",
  travelAccommodation: "landscape",
  travelForm: "landscape",
  discoverHero: "landscape",
  discoverIntro: "portrait",
  discoverFood: "landscape",
  discoverSupper: "landscape",
  discoverCafe: "landscape",
  discoverPlaces: "landscape",
  bridePortrait: "portrait",
  groomPortrait: "portrait",
};

/**
 * Returns the CSS aspect-ratio string for a given slot, reading the stored
 * imageFrames value from content with a per-slot fallback.
 */
export function frameAspect(
  content: Pick<WeddingContent, "imageFrames">,
  slot: ImageCropSlot,
): string {
  const stored = content.imageFrames?.[slot];
  const ratio: ImageFrameRatio = stored ?? SLOT_FRAME_DEFAULTS[slot] ?? "landscape";
  return FRAME_RATIOS[ratio];
}

export function imageCropStyleVars(
  content: Pick<WeddingContent, "imageCrops">,
  slot: ImageCropSlot,
) {
  const crop = normalizeImageCrop(content.imageCrops?.[slot]);
  return {
    "--image-position-desktop": imageCropPosition(crop, "desktop"),
    "--image-position-mobile": imageCropPosition(crop, "mobile"),
    "--image-origin-desktop": imageCropPosition(crop, "desktop"),
    "--image-origin-mobile": imageCropPosition(crop, "mobile"),
    "--image-scale-desktop": String(imageCropScale(crop, "desktop")),
    "--image-scale-mobile": String(imageCropScale(crop, "mobile")),
  };
}
