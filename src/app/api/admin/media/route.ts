import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { getCurrentAdmin } from "@/lib/auth";
import {
  addMediaAsset,
  getDraftContent,
  removeMediaAssetFromDraft,
  setDraftDiscoverItemImage,
  setDraftImageCrop,
  setDraftImageSlot,
} from "@/lib/data-store";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { compressWeddingImage } from "@/lib/image-compression";
import { normalizeImageCrop } from "@/lib/image-crop";
import type { ImageCropSettings, MediaAsset } from "@/lib/types";

export const runtime = "nodejs";

const bucketName = "wedding-media";
const mediaKinds: MediaAsset["kind"][] = ["hero", "gallery", "music"];
const maxImageUploadBytes = 5 * 1024 * 1024;
const maxMusicUploadBytes = 20 * 1024 * 1024;
const imageSlots = [
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
] as const;
type ImageSlot = (typeof imageSlots)[number];

function normalizeKind(
  value: FormDataEntryValue | string | null,
): MediaAsset["kind"] {
  const kind = String(value || "gallery");
  return mediaKinds.includes(kind as MediaAsset["kind"])
    ? (kind as MediaAsset["kind"])
    : "gallery";
}

function isHeicFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

function validateFileKind(file: File, kind: MediaAsset["kind"]) {
  if (kind === "hero" || kind === "gallery") {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please upload an image file for photos.");
    }
    // sharp on Vercel cannot decode HEIC/HEIF — reject early with a clear message
    if (isHeicFile(file)) {
      throw new Error(
        "HEIC/HEIF photos are not supported. Please convert to JPG or PNG first.",
      );
    }
  }
  if (kind === "music" && !file.type.startsWith("audio/")) {
    throw new Error("Please upload an audio file for music.");
  }
  if (kind === "music" && file.size > maxMusicUploadBytes) {
    throw new Error("Music upload is too large. Please keep it below 20MB.");
  }
  if (kind !== "music" && file.size > maxImageUploadBytes) {
    throw new Error(
      "Photo upload is too large. Please keep it below 5MB.",
    );
  }
}

function normalizeSlot(value: FormDataEntryValue | string | null) {
  const slot = String(value || "");
  return imageSlots.includes(slot as ImageSlot) ? (slot as ImageSlot) : null;
}

function normalizeBodySlot(value: unknown) {
  const slot = String(value || "");
  return imageSlots.includes(slot as ImageSlot) ? (slot as ImageSlot) : null;
}

function safeStorageName(fileName: string) {
  const cleaned = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "upload";
}

async function uploadToStorage(file: File, kind: MediaAsset["kind"]) {
  if (!isSupabaseConfigured()) return "/assets/wedding-hero-placeholder.png";

  const supabase = createSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const originalBytes = Buffer.from(await file.arrayBuffer());
  const upload =
    kind === "music"
      ? {
          bytes: originalBytes,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        }
      : await compressImageUpload(originalBytes, file.name, kind);
  const path = `${kind}/${Date.now()}-${safeStorageName(upload.fileName)}`;
  const { error } = await supabase.storage
    .from(bucketName)
    .upload(path, upload.bytes, {
      contentType: upload.contentType,
      upsert: false,
    });
  if (error) throw new Error(error.message);

  return supabase.storage.from(bucketName).getPublicUrl(path).data.publicUrl;
}

async function compressImageUpload(
  bytes: Buffer,
  fileName: string,
  kind: Exclude<MediaAsset["kind"], "music">,
) {
  const compressed = await compressWeddingImage(bytes, { fileName, kind });
  return {
    bytes: compressed.buffer,
    fileName: compressed.fileName,
    contentType: compressed.contentType,
  };
}

function storagePathFromPublicUrl(url: string) {
  const marker = `/storage/v1/object/public/${bucketName}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

async function deleteFromStorage(url: string) {
  if (!isSupabaseConfigured()) return;
  const storagePath = storagePathFromPublicUrl(url);
  if (!storagePath) return;
  const supabase = createSupabaseServiceClient();
  await supabase?.storage.from(bucketName).remove([storagePath]);
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uploadedUrl = "";
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const kind = normalizeKind(formData.get("kind"));
    const slot = normalizeSlot(formData.get("slot"));
    const discoverItemId = String(formData.get("discoverItemId") || "").trim();
    if (!file)
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    validateFileKind(file, kind);
    if (slot && kind === "music") {
      return NextResponse.json(
        { error: "Music cannot be assigned to a photo slot." },
        { status: 400 },
      );
    }
    if (discoverItemId && kind === "music") {
      return NextResponse.json(
        { error: "Music cannot be assigned to a Discover item." },
        { status: 400 },
      );
    }

    const uploadedAt = Date.now();
    const url = await uploadToStorage(file, kind);
    uploadedUrl = url;
    const sortOrder = Math.floor(uploadedAt / 1000);
    const asset: MediaAsset = {
      id: `media-${uploadedAt}`,
      kind,
      url,
      alt: {
        en: file.name,
        id: file.name,
      },
      sortOrder,
      isPublished: false,
    };

    const savedAsset = await addMediaAsset(asset, {
      applyToContent: !slot && !discoverItemId,
    });
    if (slot) {
      return NextResponse.json({
        asset: savedAsset,
        content: await setDraftImageSlot(slot, url),
      });
    }
    if (discoverItemId) {
      return NextResponse.json({
        asset: savedAsset,
        content: await setDraftDiscoverItemImage(discoverItemId, url),
      });
    }

    return NextResponse.json({
      asset: savedAsset,
      content: await getDraftContent(),
    });
  } catch (error) {
    if (uploadedUrl) await deleteFromStorage(uploadedUrl);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to upload media.",
      },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { action, crop, slot, url } = (await request.json()) as {
      action?: string;
      crop?: ImageCropSettings;
      slot?: ImageSlot;
      url?: string;
    };
    const safeSlot = normalizeBodySlot(slot);
    if (action === "setImageCrop") {
      if (!safeSlot) {
        return NextResponse.json(
          { error: "Image slot is required." },
          { status: 400 },
        );
      }
      return NextResponse.json({
        content: await setDraftImageCrop(
          safeSlot,
          normalizeImageCrop(crop),
        ),
      });
    }
    if (!url)
      return NextResponse.json(
        { error: "Media URL is required." },
        { status: 400 },
      );
    if (action === "setHero")
      return NextResponse.json({
        content: await setDraftImageSlot("hero", url),
      });
    if (action !== "setImageSlot" || !safeSlot) {
      return NextResponse.json(
        { error: "Unsupported media action." },
        { status: 400 },
      );
    }
    return NextResponse.json({ content: await setDraftImageSlot(safeSlot, url) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update media.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { kind, url } = (await request.json()) as {
      kind?: MediaAsset["kind"];
      url?: string;
    };
    if (!url)
      return NextResponse.json(
        { error: "Media URL is required." },
        { status: 400 },
      );
    const safeKind = mediaKinds.includes(kind as MediaAsset["kind"])
      ? (kind as MediaAsset["kind"])
      : "gallery";
    const content = await removeMediaAssetFromDraft(safeKind, url);
    await deleteFromStorage(url);
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to remove media.",
      },
      { status: 400 },
    );
  }
}
