import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { getCurrentAdmin } from "@/lib/auth";
import {
  addMediaAsset,
  getDraftContent,
  removeMediaAssetFromDraft,
  setDraftHeroImage
} from "@/lib/data-store";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";
import type { MediaAsset } from "@/lib/types";

const bucketName = "wedding-media";
const mediaKinds: MediaAsset["kind"][] = ["hero", "gallery", "music"];

function normalizeKind(value: FormDataEntryValue | string | null): MediaAsset["kind"] {
  const kind = String(value || "gallery");
  return mediaKinds.includes(kind as MediaAsset["kind"]) ? (kind as MediaAsset["kind"]) : "gallery";
}

function validateFileKind(file: File, kind: MediaAsset["kind"]) {
  if ((kind === "hero" || kind === "gallery") && !file.type.startsWith("image/")) {
    throw new Error("Please upload an image file for photos.");
  }
  if (kind === "music" && !file.type.startsWith("audio/")) {
    throw new Error("Please upload an audio file for music.");
  }
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

  const path = `${kind}/${Date.now()}-${safeStorageName(file.name)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(bucketName).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });
  if (error) throw new Error(error.message);

  return supabase.storage.from(bucketName).getPublicUrl(path).data.publicUrl;
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
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uploadedUrl = "";
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const kind = normalizeKind(formData.get("kind"));
    if (!file) return NextResponse.json({ error: "File is required." }, { status: 400 });
    validateFileKind(file, kind);

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
        id: file.name
      },
      sortOrder,
      isPublished: false
    };

    const savedAsset = await addMediaAsset(asset);
    return NextResponse.json({ asset: savedAsset, content: await getDraftContent() });
  } catch (error) {
    if (uploadedUrl) await deleteFromStorage(uploadedUrl);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload media." },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { action, url } = (await request.json()) as { action?: string; url?: string };
    if (!url) return NextResponse.json({ error: "Media URL is required." }, { status: 400 });
    if (action !== "setHero") return NextResponse.json({ error: "Unsupported media action." }, { status: 400 });
    return NextResponse.json({ content: await setDraftHeroImage(url) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update media." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { kind, url } = (await request.json()) as { kind?: MediaAsset["kind"]; url?: string };
    if (!url) return NextResponse.json({ error: "Media URL is required." }, { status: 400 });
    const safeKind = mediaKinds.includes(kind as MediaAsset["kind"]) ? (kind as MediaAsset["kind"]) : "gallery";
    const content = await removeMediaAssetFromDraft(safeKind, url);
    await deleteFromStorage(url);
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove media." },
      { status: 400 }
    );
  }
}
