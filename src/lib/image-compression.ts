import sharp from "sharp";
import type { MediaAsset } from "@/lib/types";

export interface CompressedImage {
  buffer: Buffer;
  contentType: "image/webp";
  fileName: string;
  originalSize: number;
  compressedSize: number;
  width?: number;
  height?: number;
}

const imageSizes: Record<Exclude<MediaAsset["kind"], "music">, number> = {
  hero: 2400,
  gallery: 1800,
};

function baseFileName(fileName: string) {
  const cleanName = fileName
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleanName || "image";
}

export async function compressWeddingImage(
  input: Buffer,
  options: {
    fileName: string;
    kind: Exclude<MediaAsset["kind"], "music">;
    maxWidth?: number;
  },
): Promise<CompressedImage> {
  const maxWidth = options.maxWidth || imageSizes[options.kind];
  const image = sharp(input, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const output = await image
    .resize({
      width: maxWidth,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({
      // Higher quality (less compression) for sharper photos. effort 6 keeps
      // file size in check at the higher quality (slower encode, server-side).
      quality: options.kind === "hero" ? 90 : 86,
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer();

  return {
    buffer: output,
    contentType: "image/webp",
    fileName: `${baseFileName(options.fileName)}.webp`,
    originalSize: input.length,
    compressedSize: output.length,
    width: metadata.width,
    height: metadata.height,
  };
}
