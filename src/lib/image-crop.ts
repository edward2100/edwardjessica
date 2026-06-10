import type {
  ImageCropSettings,
  ImageCropSlot,
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
];

function clampPercent(value: unknown, fallback: number) {
  const numberValue =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(100, Math.max(0, Math.round(numberValue)));
}

function clampZoom(value: unknown, fallback: number) {
  const numberValue =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(2.5, Math.max(1, Math.round(numberValue * 100) / 100));
}

export function normalizeImageCrop(
  crop: Partial<ImageCropSettings> | null | undefined,
): ImageCropSettings {
  return {
    desktop: {
      x: clampPercent(crop?.desktop?.x, defaultImageCrop.desktop.x),
      y: clampPercent(crop?.desktop?.y, defaultImageCrop.desktop.y),
      zoom: clampZoom(crop?.desktop?.zoom, defaultImageCrop.desktop.zoom),
    },
    mobile: {
      x: clampPercent(crop?.mobile?.x, defaultImageCrop.mobile.x),
      y: clampPercent(crop?.mobile?.y, defaultImageCrop.mobile.y),
      zoom: clampZoom(crop?.mobile?.zoom, defaultImageCrop.mobile.zoom),
    },
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
