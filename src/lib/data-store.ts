import type {
  AdminGuestInput,
  AdminInvitationUpsert,
  AdminMessageLog,
  AdminSnapshot,
  AdminWhatsAppMessageType,
  AdminRsvpUpdate,
  BrideGroomFrame,
  DashboardStats,
  DiscoverMedanContent,
  DiscoverMedanGuideItem,
  DiscoverMedanGuideSection,
  DiscoverMedanSectionId,
  EventKey,
  Guest,
  GuestCsvRow,
  ImageCropSettings,
  ImageCropSlot,
  InvitationGroup,
  InvitationTravelOverrides,
  MediaAsset,
  OpeningAnimation,
  PublicInviteFlow,
  PublicInviteType,
  RsvpHistoryItem,
  RsvpSubmission,
  SelfRegistrationSubmission,
  TravelPlan,
  TravelPlanSubmission,
  WeddingContent,
} from "@/lib/types";
import { discoverMedanSectionOrder } from "@/lib/discover-medan-content";
import { isSupabaseConfigured } from "@/lib/env";
import { normalizeImageCrop, normalizeImageCrops } from "@/lib/image-crop";
import {
  buildNameInviteCode,
  ensureEligibleEvents,
  eventKeys,
  generateInviteCode,
  hasAtLeastOneAttendingEvent,
} from "@/lib/rsvp";
import { sampleHistory, sampleInvitations } from "@/lib/seed";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { weddingContent } from "@/lib/wedding-content";

interface PreviewStore {
  content: WeddingContent;
  draftContent: WeddingContent;
  invitations: InvitationGroup[];
  history: RsvpHistoryItem[];
  messageLogs: AdminMessageLog[];
  travelPlans: TravelPlan[];
  openEvents: number;
}

const globalStore = globalThis as typeof globalThis & {
  __ejPreviewStore?: PreviewStore;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function previewStore() {
  if (!globalStore.__ejPreviewStore) {
    globalStore.__ejPreviewStore = {
      content: clone(weddingContent),
      draftContent: clone(weddingContent),
      invitations: clone(sampleInvitations),
      history: clone(sampleHistory),
      messageLogs: [],
      travelPlans: [],
      openEvents: sampleInvitations.filter((item) => item.openedAt).length,
    };
  }
  return globalStore.__ejPreviewStore;
}

function normalizeWeddingEvents(
  events: WeddingContent["events"] | undefined,
): WeddingContent["events"] {
  const provided = Array.isArray(events) ? events : [];
  const providedByKey = new Map(provided.map((event) => [event.key, event]));
  return weddingContent.events.map((defaultEvent) => {
    const providedEvent = providedByKey.get(defaultEvent.key);
    return {
      ...defaultEvent,
      date: providedEvent?.date || defaultEvent.date,
      startTime: providedEvent?.startTime || defaultEvent.startTime,
      endTime: providedEvent?.endTime || defaultEvent.endTime,
      // mapUrl: prefer stored value, then default (which may be undefined for holy_matrimony)
      mapUrl: providedEvent?.mapUrl !== undefined
        ? (providedEvent.mapUrl || undefined)
        : defaultEvent.mapUrl,
    };
  });
}

function normalizeWeddingContent(
  content: Partial<WeddingContent>,
): WeddingContent {
  return {
    ...weddingContent,
    ...content,
    parents: {
      ...weddingContent.parents,
      ...content.parents,
    },
    venue: {
      ...weddingContent.venue,
      ...content.venue,
    },
    heroImageUrl: content.heroImageUrl || weddingContent.heroImageUrl,
    invitationImageUrl:
      content.invitationImageUrl || weddingContent.invitationImageUrl,
    storyImageUrl: content.storyImageUrl || weddingContent.storyImageUrl,
    travelHeroImageUrl:
      content.travelHeroImageUrl ||
      content.invitationImageUrl ||
      weddingContent.travelHeroImageUrl,
    travelAirportImageUrl:
      content.travelAirportImageUrl || weddingContent.travelAirportImageUrl,
    travelAccommodationImageUrl:
      content.travelAccommodationImageUrl ||
      weddingContent.travelAccommodationImageUrl,
    travelFormImageUrl:
      content.travelFormImageUrl ||
      content.storyImageUrl ||
      weddingContent.travelFormImageUrl,
    discoverHeroImageUrl:
      content.discoverHeroImageUrl ||
      content.travelHeroImageUrl ||
      weddingContent.discoverHeroImageUrl,
    discoverIntroImageUrl:
      content.discoverIntroImageUrl ||
      content.invitationImageUrl ||
      weddingContent.discoverIntroImageUrl,
    discoverFoodImageUrl:
      content.discoverFoodImageUrl ||
      content.storyImageUrl ||
      weddingContent.discoverFoodImageUrl,
    discoverSupperImageUrl:
      content.discoverSupperImageUrl ||
      content.travelFormImageUrl ||
      weddingContent.discoverSupperImageUrl,
    discoverCafeImageUrl:
      content.discoverCafeImageUrl ||
      content.heroImageUrl ||
      weddingContent.discoverCafeImageUrl,
    imageCrops: normalizeImageCrops(content.imageCrops),
    // New fields — safe defaults so old published JSON renders identically
    images: content.images ?? weddingContent.images,
    mobileImages: content.mobileImages ?? weddingContent.mobileImages,
    imageFrames: content.imageFrames ?? weddingContent.imageFrames,
    // Existing published JSON has no brideGroomFrame — fall back to "arch".
    brideGroomFrame: normalizeBrideGroomFrame(content.brideGroomFrame),
    // Existing published JSON has no openingAnimation — fall back to "classic"
    // so the live site keeps its current open-invitation flow unchanged.
    openingAnimation: normalizeOpeningAnimation(content.openingAnimation),
    discoverMedan: normalizeDiscoverMedanContent(content.discoverMedan),
    publicInviteTypes: normalizePublicInviteTypes(content.publicInviteTypes),
    gallery: content.gallery || weddingContent.gallery,
    events: normalizeWeddingEvents(content.events),
    notes: content.notes || weddingContent.notes,
  };
}

const brideGroomFrames: BrideGroomFrame[] = ["arch", "oval", "octagon", "petal"];

function normalizeBrideGroomFrame(value: unknown): BrideGroomFrame {
  return brideGroomFrames.includes(value as BrideGroomFrame)
    ? (value as BrideGroomFrame)
    : "arch";
}

const openingAnimations: OpeningAnimation[] = [
  "classic",
  "moongate",
  "envelope",
];

function normalizeOpeningAnimation(value: unknown): OpeningAnimation {
  return openingAnimations.includes(value as OpeningAnimation)
    ? (value as OpeningAnimation)
    : "classic";
}

function normalizeLocalizedString(
  value: Partial<Record<"en" | "id", unknown>> | undefined,
  fallback: { en: string; id: string },
) {
  const en = cleanOptionalText(String(value?.en || ""));
  const id = cleanOptionalText(String(value?.id || ""));
  return {
    en: en || fallback.en,
    id: id || fallback.id,
  };
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

function normalizeDiscoverSectionId(value: unknown): DiscoverMedanSectionId {
  return discoverMedanSectionOrder.includes(value as DiscoverMedanSectionId)
    ? (value as DiscoverMedanSectionId)
    : "localFood";
}

function normalizeDiscoverMedanItem(
  item: Partial<DiscoverMedanGuideItem>,
  fallback: DiscoverMedanGuideItem,
  index: number,
): DiscoverMedanGuideItem {
  return {
    id: String(item.id || fallback.id || `item-${index + 1}`),
    name: normalizeLocalizedString(item.name, fallback.name),
    note: normalizeLocalizedString(item.note, fallback.note),
    imageUrl: cleanOptionalText(String(item.imageUrl || "")),
    mapUrl: cleanOptionalText(String(item.mapUrl || "")),
  };
}

function normalizeDiscoverMedanSection(
  section: Partial<DiscoverMedanGuideSection>,
  fallback: DiscoverMedanGuideSection,
): DiscoverMedanGuideSection {
  const providedItems = Array.isArray(section.items) ? section.items : null;
  const fallbackItems = fallback.items;
  const items = providedItems
    ? providedItems.map((item, index) =>
        normalizeDiscoverMedanItem(
          item,
          fallbackItems[index] || {
            id: `custom-${fallback.id}-${index + 1}`,
            name: { en: "New place", id: "Tempat baru" },
            note: { en: "", id: "" },
          },
          index,
        ),
      )
    : fallbackItems;

  return {
    id: normalizeDiscoverSectionId(section.id || fallback.id),
    eyebrow: normalizeLocalizedString(section.eyebrow, fallback.eyebrow),
    title: normalizeLocalizedString(section.title, fallback.title),
    intro: normalizeLocalizedString(section.intro, fallback.intro),
    items,
  };
}

function normalizeDiscoverMedanContent(
  content: Partial<DiscoverMedanContent> | undefined,
): DiscoverMedanContent {
  const fallback = weddingContent.discoverMedan;
  const providedSections = Array.isArray(content?.sections)
    ? content.sections
    : [];
  const providedById = new Map(
    providedSections
      .filter((section) => section?.id)
      .map((section) => [section.id, section]),
  );

  return {
    heroKicker: normalizeDiscoverHeroKicker(
      normalizeLocalizedString(
        content?.heroKicker,
        fallback.heroKicker,
      ),
    ),
    heroTitle: normalizeLocalizedString(content?.heroTitle, fallback.heroTitle),
    heroSubtitle: normalizeLocalizedString(
      content?.heroSubtitle,
      fallback.heroSubtitle,
    ),
    heroButton: normalizeLocalizedString(
      content?.heroButton,
      fallback.heroButton,
    ),
    introEyebrow: normalizeLocalizedString(
      content?.introEyebrow,
      fallback.introEyebrow,
    ),
    introTitle: normalizeLocalizedString(
      content?.introTitle,
      fallback.introTitle,
    ),
    introParagraphs: {
      en: normalizeStringArray(
        content?.introParagraphs?.en,
        fallback.introParagraphs.en,
      ),
      id: normalizeStringArray(
        content?.introParagraphs?.id,
        fallback.introParagraphs.id,
      ),
    },
    sections: discoverMedanSectionOrder.map((sectionId) => {
      const fallbackSection = fallback.sections.find(
        (section) => section.id === sectionId,
      );
      const providedSection = providedById.get(sectionId);
      return normalizeDiscoverMedanSection(
        providedSection || {},
        fallbackSection || fallback.sections[0],
      );
    }),
  };
}

function normalizeDiscoverHeroKicker(value: { en: string; id: string }) {
  const legacy = ["Wedding Weekend Guide", "Panduan Akhir Pekan Pernikahan"];
  return {
    en: legacy.includes(value.en) ? "" : value.en,
    id: legacy.includes(value.id) ? "" : value.id,
  };
}

function normalizePublicInviteTypes(
  inviteTypes: Partial<PublicInviteType>[] | undefined,
) {
  const defaults = weddingContent.publicInviteTypes;
  const provided = Array.isArray(inviteTypes) ? inviteTypes : [];
  const providedById = new Map(
    provided
      .filter((inviteType) => inviteType.id)
      .map((inviteType) => [inviteType.id, inviteType]),
  );
  const normalizedDefaults = defaults.map((defaultType) => {
    const providedType = providedById.get(defaultType.id);
    return normalizePublicInviteType(
      {
        ...defaultType,
        ...providedType,
      },
      defaultType,
    );
  });
  const customTypes = provided.filter(
    (inviteType) =>
      inviteType.id && !defaults.some((item) => item.id === inviteType.id),
  );
  return [
    ...normalizedDefaults,
    ...customTypes.map((inviteType, index) =>
      normalizePublicInviteType(inviteType, {
        ...defaults[0],
        id: `custom-${index + 1}`,
        code: `EJ${String(index + 1).padStart(2, "0")}`,
        label: { en: "Custom Guests", id: "Tamu Khusus" },
        description: { en: "Custom RSVP link.", id: "Tautan RSVP khusus." },
      }),
    ),
  ];
}

function normalizePublicInviteType(
  inviteType: Partial<PublicInviteType>,
  fallback: PublicInviteType,
): PublicInviteType {
  const code = String(inviteType.code || fallback.code)
    .trim()
    .toUpperCase();
  const flow =
    inviteType.flow === "generic" ||
    inviteType.flow === "family" ||
    inviteType.flow === "overseas"
      ? inviteType.flow
      : fallback.flow;

  return {
    id: inviteType.id || fallback.id,
    label: {
      en: inviteType.label?.en || fallback.label.en,
      id: inviteType.label?.id || fallback.label.id,
    },
    code: code || fallback.code,
    flow,
    maxGuests:
      flow === "overseas"
        ? 1
        : Math.min(
            10,
            Math.max(1, Number(inviteType.maxGuests) || fallback.maxGuests),
          ),
    requireGuestNames:
      inviteType.requireGuestNames ?? fallback.requireGuestNames,
    isEnabled: inviteType.isEnabled !== false,
    description: {
      en: inviteType.description?.en || fallback.description?.en || "",
      id: inviteType.description?.id || fallback.description?.id || "",
    },
  };
}

function cleanOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeInvitationFlow(value: unknown): PublicInviteFlow {
  const normalized = String(value || "generic")
    .trim()
    .toLowerCase();
  if (normalized === "general") return "generic";
  if (
    normalized === "generic" ||
    normalized === "family" ||
    normalized === "overseas"
  ) {
    return normalized;
  }
  return "generic";
}

function normalizePrivateNotes(notes: AdminInvitationUpsert["privateNotes"]) {
  const en = cleanOptionalText(notes?.en);
  const id = cleanOptionalText(notes?.id);
  if (!en && !id) return undefined;
  return {
    en: en || id || "",
    id: id || en || "",
  };
}

function privateNotesPayload(
  notes: InvitationGroup["privateNotes"] | undefined,
  flow: PublicInviteFlow,
) {
  return {
    ...(notes || {}),
    inviteFlow: flow,
  };
}

function maxGuestsForInvitation(
  value: unknown,
  guests: Array<{ id?: string }>,
) {
  const parsed = Number(value);
  return Math.min(
    10,
    Math.max(guests.length || 1, Number.isFinite(parsed) ? parsed : guests.length || 1),
  );
}

function publicPrivateNotes(value: unknown): InvitationGroup["privateNotes"] {
  const notes = value as Partial<Record<"en" | "id", unknown>> | undefined;
  const en = cleanOptionalText(String(notes?.en || ""));
  const id = cleanOptionalText(String(notes?.id || ""));
  if (!en && !id) return undefined;
  return {
    en: en || id || "",
    id: id || en || "",
  };
}

function rowInvitationFlow(row: any): PublicInviteFlow {
  const explicitFlow =
    row.flow || row.private_notes?.inviteFlow || row.private_notes?.flow;
  if (explicitFlow) return normalizeInvitationFlow(explicitFlow);
  const familyHint = `${row.group_name || ""} ${row.greeting || ""}`;
  if (/\bfamily\b|keluarga/i.test(familyHint)) return "family";
  return "generic";
}

// B8: detect missing column errors via PG code 42703 and the column name,
// rather than a loose message regex that can match unrelated errors.
function missingFlowColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  // PG "undefined_column" error code
  if (error.code === "42703") {
    const msg = error.message || "";
    return /\bflow\b|\bmax_guests\b/.test(msg);
  }
  // fallback for non-PG drivers that may not surface the code
  return /flow|schema cache/i.test(error.message || "");
}

// Detect when the travel_overrides column has not been migrated yet so admin
// saves still succeed (overrides silently ignored until the SQL is run).
function missingTravelOverridesColumn(
  error: { code?: string; message?: string } | null,
) {
  if (!error) return false;
  const msg = error.message || "";
  if (error.code === "42703") return /travel_overrides/.test(msg);
  return /travel_overrides/i.test(msg);
}

function normalizeAdminGuest(guest: AdminGuestInput): AdminGuestInput {
  // Names are optional at the admin level: an admin can create a party with
  // just a group label + max size and let guests enter their own names on
  // RSVP. Empty-name rows are dropped by the caller.
  return {
    id: guest.id,
    name: cleanOptionalText(guest.name) || "",
    mealPreference: mealPreferenceOrUnset(guest.mealPreference),
  };
}

function mealPreferenceOrUnset(value: unknown): Guest["mealPreference"] {
  return value === "vegetarian" ||
    value === "non_vegetarian" ||
    value === "unset"
    ? value
    : "unset";
}

function normalizeAdminInvitationInput(
  input: AdminInvitationUpsert,
): AdminInvitationUpsert {
  const groupName = cleanOptionalText(input.groupName);
  const greeting = cleanOptionalText(input.greeting);
  if (!groupName) throw new Error("Group name is required.");
  if (!greeting) throw new Error("Greeting is required.");

  const eligibleEvents = input.eligibleEvents.filter(
    (eventKey): eventKey is EventKey => eventKeys.includes(eventKey),
  );
  if (!eligibleEvents.length)
    throw new Error("Select at least one eligible event.");

  // Drop blank rows: a party may have zero pre-named guests (guests enter
  // their own names on RSVP). The group is identified by its groupName.
  const guests = input.guests
    .map(normalizeAdminGuest)
    .filter((guest) => guest.name);
  const rawMaxGuests = Number(input.maxGuests);
  const maxGuests = Math.min(
    10,
    Math.max(1, guests.length, Number.isFinite(rawMaxGuests) ? rawMaxGuests : 1),
  );

  const flow = normalizeInvitationFlow(input.flow);
  // Travel overrides only apply to the overseas flow; drop them otherwise so a
  // flow change can't leave stale overrides behind.
  const travelOverrides =
    flow === "overseas"
      ? normalizeTravelOverrides(input.travelOverrides)
      : undefined;

  return {
    code: input.code ? input.code.trim().toUpperCase() : undefined,
    groupName,
    greeting,
    phone: cleanOptionalText(input.phone),
    email: cleanOptionalText(input.email),
    maxGuests,
    side:
      input.side === "groom" || input.side === "bride" || input.side === "joint"
        ? input.side
        : "joint",
    flow,
    privateNotes: normalizePrivateNotes(input.privateNotes),
    eligibleEvents,
    guests,
    travelOverrides,
  };
}

function adjustRsvpForEligibleEvents(
  invitation: InvitationGroup,
  eligibleEvents: EventKey[],
): InvitationGroup["rsvp"] {
  if (invitation.rsvp.status === "pending") {
    return {
      ...invitation.rsvp,
      eventAttendance: {},
    };
  }

  if (invitation.rsvp.status === "declined") {
    return {
      ...invitation.rsvp,
      eventAttendance: Object.fromEntries(
        eligibleEvents.map((eventKey) => [eventKey, false]),
      ),
    };
  }

  const existingAttendance = ensureEligibleEvents(
    invitation.rsvp.eventAttendance,
    eligibleEvents,
  );
  const eventAttendance = hasAtLeastOneAttendingEvent(existingAttendance)
    ? existingAttendance
    : Object.fromEntries(eligibleEvents.map((eventKey) => [eventKey, true]));
  return {
    ...invitation.rsvp,
    eventAttendance,
  };
}

export async function getPublishedContent(): Promise<WeddingContent> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B2: throw on query error — do NOT fall through to preview store
    const { data, error } = await supabase
      .from("content_versions")
      .select("content,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.content) {
      return {
        ...normalizeWeddingContent(data.content as Partial<WeddingContent>),
        publishedAt: data.published_at || undefined,
      };
    }
    // No published content yet — return defaults
    return normalizeWeddingContent({});
  }
  return normalizeWeddingContent(clone(previewStore().content));
}

export async function getDraftContent(): Promise<WeddingContent> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B2: throw on query error — do NOT fall through to preview store
    const { data, error } = await supabase
      .from("content_versions")
      .select("content")
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.content)
      return normalizeWeddingContent(data.content as Partial<WeddingContent>);
    // No draft yet — fall back to published or defaults
    return getPublishedContent();
  }
  return normalizeWeddingContent(clone(previewStore().draftContent));
}

export async function saveDraftContent(content: WeddingContent) {
  const normalizedContent = normalizeWeddingContent(content);
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B1: check write error
    const { error } = await supabase.from("content_versions").insert({
      status: "draft",
      content: normalizedContent,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  } else {
    previewStore().draftContent = clone(normalizedContent);
  }
  return getDraftContent();
}

export async function publishDraftContent() {
  const draft = await getDraftContent();
  const published = {
    ...draft,
    publishedAt: new Date().toISOString(),
  };
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B1: check write error
    const { error } = await supabase.from("content_versions").insert({
      status: "published",
      content: published,
      published_at: published.publishedAt,
      updated_at: published.publishedAt,
    });
    if (error) throw new Error(error.message);
    const mediaUrls = publishedMediaUrls(published);
    if (mediaUrls.length) {
      // B1: check media update error
      const { error: mediaError } = await supabase
        .from("media_assets")
        .update({ is_published: true })
        .in("url", mediaUrls);
      if (mediaError) throw new Error(mediaError.message);
    }
  } else {
    previewStore().content = clone(published);
    previewStore().draftContent = clone(published);
  }
  return published;
}

function publishedMediaUrls(content: WeddingContent) {
  return Array.from(
    new Set(
      [
        content.heroImageUrl,
        content.invitationImageUrl,
        content.storyImageUrl,
        content.travelHeroImageUrl,
        content.travelAirportImageUrl,
        content.travelAccommodationImageUrl,
        content.travelFormImageUrl,
        content.discoverHeroImageUrl,
        content.discoverIntroImageUrl,
        content.discoverFoodImageUrl,
        content.discoverSupperImageUrl,
        content.discoverCafeImageUrl,
        content.musicUrl,
        ...content.discoverMedan.sections.flatMap((section) =>
          section.items.map((item) => item.imageUrl).filter(Boolean),
        ),
        ...content.gallery.map((asset) => asset.url),
      ].filter((url): url is string => Boolean(url)),
    ),
  );
}

export async function getInvitationByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B2: throw on query error — do NOT fall through to preview store
    const { data, error } = await supabase
      .from("invitation_groups")
      .select("*,rsvps(*),guests(*)")
      .eq("code", normalizedCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return mapInvitationRow(data);
    return null;
  }

  return clone(
    previewStore().invitations.find(
      (invite) => invite.code === normalizedCode,
    ) || null,
  );
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

// B3: escape ilike wildcard characters so a guest email containing %, _, or \
// does not accidentally match unintended rows.
function escapeLikePattern(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function scoreResolvedInvitation(invitation: InvitationGroup) {
  const submittedScore = invitation.rsvp.status === "pending" ? 0 : 1000;
  const updatedAt = invitation.rsvp.updatedAt || invitation.rsvp.submittedAt || "";
  const timeScore = updatedAt ? new Date(updatedAt).getTime() / 1000000000 : 0;
  return submittedScore + timeScore;
}

export async function getInvitationByVerifiedEmail(
  email: string,
  flow?: PublicInviteFlow,
) {
  const verifiedEmail = normalizeEmail(email);
  if (!verifiedEmail) return null;
  const normalizedFlow = flow ? normalizeInvitationFlow(flow) : undefined;

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B3: escape wildcard characters before ilike to prevent injection
    // B2: throw on query error — do NOT fall through to preview store
    const { data, error } = await supabase
      .from("invitation_groups")
      .select("*,rsvps(*),guests(*)")
      .ilike("email", escapeLikePattern(verifiedEmail))
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const invitations = (data || [])
      .map(mapInvitationRow)
      .filter((invitation) =>
        normalizedFlow ? invitation.flow === normalizedFlow : true,
      )
      .sort(
        (first, second) =>
          scoreResolvedInvitation(second) - scoreResolvedInvitation(first),
      );
    return invitations[0] || null;
  }

  const invitations = previewStore()
    .invitations.filter((invitation) => {
      const emailMatches =
        normalizeEmail(invitation.email || "") === verifiedEmail;
      const flowMatches = normalizedFlow
        ? invitation.flow === normalizedFlow
        : true;
      return emailMatches && flowMatches;
    })
    .sort(
      (first, second) =>
        scoreResolvedInvitation(second) - scoreResolvedInvitation(first),
    );
  return clone(invitations[0] || null);
}

export async function ensureInvitationEmailAllowed(
  code: string,
  email: string,
  options: { claimIfEmpty?: boolean } = {},
) {
  const invitation = await getInvitationByCode(code);
  if (!invitation) throw new Error("Invitation not found");

  const verifiedEmail = normalizeEmail(email);
  if (!verifiedEmail) throw new Error("Verified email is required.");

  if (invitation.email) {
    if (normalizeEmail(invitation.email) !== verifiedEmail) {
      throw new Error("Please verify the email assigned to this invitation.");
    }
    return invitation;
  }

  if (!options.claimIfEmpty) return invitation;

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B4: conditional update — only claim if email is still null at write time
    // (prevents TOCTOU race where two requests both see email=null)
    const { data: updated, error } = await supabase
      .from("invitation_groups")
      .update({ email: verifiedEmail })
      .eq("id", invitation.id)
      .is("email", null)
      .select("id,email");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) {
      // Another request claimed the slot first — re-fetch to check
      const latest = await getInvitationByCode(code);
      if (
        latest?.email &&
        normalizeEmail(latest.email) !== verifiedEmail
      ) {
        throw new Error("Please verify the email assigned to this invitation.");
      }
      return latest || invitation;
    }
  } else {
    const store = previewStore();
    const target = store.invitations.find((item) => item.id === invitation.id);
    if (target) target.email = verifiedEmail;
  }

  return {
    ...invitation,
    email: verifiedEmail,
  };
}

export async function recordInviteOpen(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B2: throw on query error
    const { data, error: lookupError } = await supabase
      .from("invitation_groups")
      .select("id")
      .eq("code", normalizedCode)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (data?.id) {
      // B1: check insert error — invite opens are best-effort; log but don't throw
      const { error } = await supabase
        .from("invite_open_events")
        .insert({
          invitation_group_id: data.id,
          opened_at: new Date().toISOString(),
        });
      if (error) {
        console.error("[recordInviteOpen] Failed to insert open event:", error.message);
      }
    }
    return;
  }

  const store = previewStore();
  const invitation = store.invitations.find(
    (item) => item.code === normalizedCode,
  );
  if (invitation && !invitation.openedAt) {
    invitation.openedAt = new Date().toISOString();
    store.openEvents += 1;
  }
}

export async function submitRsvp(
  submission: RsvpSubmission,
  changedBy: "guest" | "admin" = "guest",
) {
  const invitation = await getInvitationByCode(submission.code);
  if (!invitation) throw new Error("Invitation not found");

  const eventAttendance = ensureEligibleEvents(
    submission.eventAttendance,
    invitation.eligibleEvents,
  );

  // B11: replace silent attending→declined flip with an explicit error.
  // Guests must select at least one event when claiming "attending".
  if (
    submission.status === "attending" &&
    !hasAtLeastOneAttendingEvent(eventAttendance)
  ) {
    throw new Error("Please select at least one event you will attend.");
  }

  const status = submission.status;
  const updatedAt = new Date().toISOString();

  // B9: deduplicate additionalGuests against existing non-primary guests.
  // An entry with a matching id OR (no id AND case-insensitive trimmed name match)
  // is treated as an update to an existing guest, not a new insert.
  const existingNonPrimary = invitation.guests.slice(1); // primary guest is guests[0]
  const rawAdditional =
    status === "attending"
      ? (submission.additionalGuests || [])
          .map((guest) => ({
            id: guest.id,
            invitationGroupId: invitation.id,
            name: cleanOptionalText(guest.name) || "",
            mealPreference: mealPreferenceOrUnset(guest.mealPreference),
          }))
          .filter((guest) => guest.name)
      : [];

  // Separate into updates (match existing) and new inserts
  const additionalGuestsWithIds: Array<{
    id?: string;
    invitationGroupId: string;
    name: string;
    mealPreference: Guest["mealPreference"];
    isExisting: boolean;
  }> = rawAdditional.map((guest) => {
    const matchById = guest.id
      ? invitation.guests.find((existing) => existing.id === guest.id)
      : undefined;
    const matchByName = !guest.id
      ? existingNonPrimary.find(
          (existing) =>
            existing.name.trim().toLowerCase() === guest.name.trim().toLowerCase(),
        )
      : undefined;
    const match = matchById || matchByName;
    return {
      ...guest,
      id: match?.id || guest.id,
      isExisting: Boolean(match),
    };
  });

  // For max-guest check, count truly new additions (not updates to existing slots)
  const newAdditions = additionalGuestsWithIds.filter((g) => !g.isExisting);
  const existingPrimaryCount = invitation.guests.length;
  // "existing non-primary updates" don't add to the count — only new ones do
  const projectedTotal = existingPrimaryCount + newAdditions.length;

  if (projectedTotal > invitation.maxGuests) {
    throw new Error(
      `This invitation allows up to ${invitation.maxGuests} guests.`,
    );
  }
  if (
    rawAdditional.some((guest) => guest.mealPreference === "unset")
  ) {
    throw new Error("Please select a meal preference for every added guest.");
  }

  // Build the final guest list:
  // - existing guests with potentially updated meal preferences
  // - existing non-primary guests with name/meal updates from submission
  // - genuinely new guests
  const existingGuestIds = new Set(invitation.guests.map((g) => g.id));
  const updatedExistingGuests = invitation.guests.map((guest) => ({
    ...guest,
    mealPreference:
      submission.mealPreferences[guest.id] || guest.mealPreference,
  }));
  // Apply name/meal updates from additionalGuestsWithIds to existing guests
  for (const ag of additionalGuestsWithIds) {
    if (ag.isExisting && ag.id) {
      const idx = updatedExistingGuests.findIndex((g) => g.id === ag.id);
      if (idx >= 0) {
        updatedExistingGuests[idx] = {
          ...updatedExistingGuests[idx],
          name: ag.name,
          mealPreference: ag.mealPreference,
        };
      }
    }
  }
  const trulyNewGuests = additionalGuestsWithIds
    .filter((g) => !g.isExisting)
    .map((guest, index) => ({
      id: guest.id || `${invitation.id}-extra-${Date.now()}-${index + 1}`,
      invitationGroupId: invitation.id,
      name: guest.name,
      mealPreference: guest.mealPreference,
    }));

  const finalGuests = [...updatedExistingGuests, ...trulyNewGuests];

  // B12: when attending, reject if any guest still has mealPreference "unset"
  if (status === "attending") {
    const unsetGuest = finalGuests.find((g) => g.mealPreference === "unset");
    if (unsetGuest) {
      throw new Error(
        "Please select a meal preference for every guest attending.",
      );
    }
  }

  const updatedInvitation: InvitationGroup = {
    ...invitation,
    rsvp: {
      ...invitation.rsvp,
      status,
      eventAttendance,
      message: submission.message,
      // B13: preserve original submittedAt on resubmission
      submittedAt: invitation.rsvp.submittedAt || updatedAt,
      updatedAt,
      updatedBy: changedBy,
    },
    guests: finalGuests,
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B1: check all write errors
    const { error: rsvpError } = await supabase.from("rsvps").upsert({
      id: invitation.rsvp.id,
      invitation_group_id: invitation.id,
      status: updatedInvitation.rsvp.status,
      event_attendance: updatedInvitation.rsvp.eventAttendance,
      message: updatedInvitation.rsvp.message,
      // B13: only send submitted_at on first insert; don't reset it on resubmission
      submitted_at: updatedInvitation.rsvp.submittedAt,
      updated_at: updatedAt,
      updated_by: changedBy,
    });
    if (rsvpError) throw new Error(rsvpError.message);

    for (const guest of updatedInvitation.guests) {
      const isExistingGuest = existingGuestIds.has(guest.id);
      if (isExistingGuest) {
        const { error } = await supabase
          .from("guests")
          .update({ name: guest.name, meal_preference: guest.mealPreference })
          .eq("id", guest.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("guests")
          .insert({
            invitation_group_id: invitation.id,
            name: guest.name,
            meal_preference: guest.mealPreference,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        if (data?.id) guest.id = String(data.id);
      }
    }

    // B10: when status transitions to "declined", delete travel plan
    if (status === "declined") {
      const { error: travelError } = await supabase
        .from("travel_plans")
        .delete()
        .eq("invitation_group_id", invitation.id);
      if (travelError) {
        console.error("[submitRsvp] Failed to delete travel plan on decline:", travelError.message);
      }
    }

    const { error: historyError } = await supabase.from("rsvp_history").insert({
      invitation_group_id: invitation.id,
      status: updatedInvitation.rsvp.status,
      changed_by: changedBy,
      changed_at: updatedAt,
      snapshot: updatedInvitation.rsvp,
    });
    if (historyError) throw new Error(historyError.message);
  } else {
    const store = previewStore();
    // B10: delete travel plan on decline in preview store too
    if (status === "declined") {
      store.travelPlans = store.travelPlans.filter(
        (plan) => plan.invitationGroupId !== invitation.id,
      );
    }
    store.invitations = store.invitations.map((item) =>
      item.id === invitation.id ? updatedInvitation : item,
    );
    store.history.unshift({
      id: `history-${Date.now()}`,
      invitationGroupId: invitation.id,
      status: updatedInvitation.rsvp.status,
      changedBy,
      changedAt: updatedAt,
      snapshot: updatedInvitation.rsvp,
    });
  }

  return updatedInvitation;
}

export async function createSelfRegisteredInvitation(
  submission: SelfRegistrationSubmission,
  inviteType?: PublicInviteType,
) {
  const now = new Date().toISOString();
  const idSeed =
    submission.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "guest";
  const id = `invite-self-${idSeed}-${Date.now()}`;
  const code = buildNameInviteCode(
    submission.name,
    await getExistingInvitationCodes(),
  );
  const guestNames = buildSelfRegisteredGuestNames(submission);
  const guests: Guest[] = guestNames.map((name, index) => ({
    id: `${id}-guest-${index + 1}`,
    invitationGroupId: id,
    name,
    mealPreference:
      submission.status === "attending" ? submission.mealPreference : "unset",
  }));

  const eventAttendance = ensureEligibleEvents(
    submission.eventAttendance,
    eventKeys,
  );

  // B11: throw instead of silently flipping attending→declined
  if (
    submission.status === "attending" &&
    !hasAtLeastOneAttendingEvent(eventAttendance)
  ) {
    throw new Error("Please select at least one event you will attend.");
  }

  const status = submission.status;

  let invitation: InvitationGroup = {
    id,
    code,
    greeting: `Dear ${submission.name}`,
    groupName: submission.name,
    phone: submission.phone,
    email: submission.email,
    maxGuests: inviteType?.maxGuests || submission.guestCount,
    side: "joint",
    source: "generic",
    flow: inviteType?.flow || "generic",
    privateNotes: {
      en: `Self-registered through the ${inviteType?.label.en || "public"} invitation link (${submission.accessCode}).`,
      id: `Mendaftar sendiri melalui tautan undangan ${inviteType?.label.id || "umum"} (${submission.accessCode}).`,
    },
    eligibleEvents: eventKeys,
    openedAt: now,
    rsvp: {
      id: `rsvp-${id}`,
      invitationGroupId: id,
      status,
      eventAttendance,
      message: submission.message,
      submittedAt: now,
      updatedAt: now,
      updatedBy: "guest",
    },
    guests,
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    const groupInsert = {
      code: invitation.code,
      greeting: invitation.greeting,
      group_name: invitation.groupName,
      phone: invitation.phone,
      email: invitation.email,
      max_guests: invitation.maxGuests,
      side: invitation.side,
      source: invitation.source,
      private_notes: privateNotesPayload(
        invitation.privateNotes,
        invitation.flow,
      ),
      eligible_events: invitation.eligibleEvents,
      opened_at: invitation.openedAt,
    };

    // B5: handle unique-violation (23505) on invitation insert gracefully.
    // If the conflict is on email+flow (duplicate self-registration race), re-query
    // and return the existing invitation (idempotent success).
    let { data: insertedGroup, error } = await supabase
      .from("invitation_groups")
      .insert({ ...groupInsert, flow: invitation.flow })
      .select("id")
      .single();
    if (error && missingFlowColumn(error)) {
      // B8: missing flow/max_guests columns — legacy schema, warn loudly
      console.error(
        "[createSelfRegisteredInvitation] WARNING: flow/max_guests columns appear missing from invitation_groups. " +
          "Schema migration is required. Retrying without these columns.",
      );
      const { max_guests, ...legacyGroupInsert } = groupInsert;
      const retry = await supabase
        .from("invitation_groups")
        .insert(legacyGroupInsert)
        .select("id")
        .single();
      insertedGroup = retry.data;
      error = retry.error;
    }
    if (error) {
      // B5: on email uniqueness conflict, re-query by email+flow and return existing
      if (error.code === "23505" && submission.email) {
        const existing = await getInvitationByVerifiedEmail(
          submission.email,
          invitation.flow,
        );
        if (existing) return existing;
      }
      // B6: on code unique-violation, regenerate with numeric suffix and retry up to 3 times
      if (error.code === "23505") {
        let retried: typeof insertedGroup = null;
        let retryError: typeof error | null = error;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const suffixedCode = `${invitation.code}-${attempt}`;
          const retryResult = await supabase
            .from("invitation_groups")
            .insert({ ...groupInsert, code: suffixedCode, flow: invitation.flow })
            .select("id")
            .single();
          retried = retryResult.data;
          retryError = retryResult.error;
          if (!retryError) {
            invitation = { ...invitation, code: suffixedCode };
            break;
          }
        }
        if (retryError || !retried?.id) {
          throw new Error("Unable to generate a unique invitation code. Please try again.");
        }
        insertedGroup = retried;
      } else {
        throw new Error(error.message || "Unable to create self-registration.");
      }
    }
    if (!insertedGroup?.id)
      throw new Error("Unable to create self-registration.");

    const insertedGroupId = String(insertedGroup.id);
    invitation = {
      ...invitation,
      id: insertedGroupId,
      rsvp: {
        ...invitation.rsvp,
        invitationGroupId: insertedGroupId,
      },
      guests: invitation.guests.map((guest) => ({
        ...guest,
        invitationGroupId: insertedGroupId,
      })),
    };

    // B1: check RSVP insert error
    const { data: insertedRsvp, error: rsvpInsertError } = await supabase
      .from("rsvps")
      .insert({
        invitation_group_id: invitation.id,
        status: invitation.rsvp.status,
        event_attendance: invitation.rsvp.eventAttendance,
        message: invitation.rsvp.message,
        submitted_at: invitation.rsvp.submittedAt,
        updated_at: invitation.rsvp.updatedAt,
        updated_by: "guest",
      })
      .select("id")
      .single();
    if (rsvpInsertError) throw new Error(rsvpInsertError.message);
    if (insertedRsvp?.id) {
      invitation.rsvp.id = String(insertedRsvp.id);
    }

    // B1: check guest insert error
    const { data: insertedGuests, error: guestsInsertError } = await supabase
      .from("guests")
      .insert(
        invitation.guests.map((guest) => ({
          invitation_group_id: invitation.id,
          name: guest.name,
          meal_preference: guest.mealPreference,
        })),
      )
      .select("id,name,meal_preference");
    if (guestsInsertError) throw new Error(guestsInsertError.message);
    if (insertedGuests?.length) {
      invitation.guests = insertedGuests.map((guest) => ({
        id: String(guest.id),
        invitationGroupId: invitation.id,
        name: String(guest.name),
        mealPreference: guest.meal_preference || submission.mealPreference,
      }));
    }

    // B1: check history insert error
    const { error: historyError } = await supabase.from("rsvp_history").insert({
      invitation_group_id: invitation.id,
      status: invitation.rsvp.status,
      changed_by: "guest",
      changed_at: now,
      snapshot: invitation.rsvp,
    });
    if (historyError) throw new Error(historyError.message);
  } else {
    const store = previewStore();
    store.invitations.unshift(invitation);
    store.history.unshift({
      id: `history-${Date.now()}`,
      invitationGroupId: invitation.id,
      status: invitation.rsvp.status,
      changedBy: "guest",
      changedAt: now,
      snapshot: invitation.rsvp,
    });
  }

  return invitation;
}

function buildSelfRegisteredGuestNames(submission: SelfRegistrationSubmission) {
  if (submission.status === "declined") return [submission.name.trim()];
  const provided = (submission.guestNames || [])
    .map((name) => name.trim())
    .filter(Boolean);
  if (provided.length >= submission.guestCount)
    return provided.slice(0, submission.guestCount);
  return Array.from({ length: submission.guestCount }, (_, index) =>
    index === 0 ? submission.name : `${submission.name} Guest ${index + 1}`,
  );
}

export async function updateRsvpByAdmin(update: AdminRsvpUpdate) {
  const invitation = await getInvitationByCode(update.code);
  if (!invitation) throw new Error("Invitation not found");

  const now = new Date().toISOString();
  const eventAttendance =
    update.status === "attending"
      ? Object.fromEntries(
          invitation.eligibleEvents.map((eventKey) => [eventKey, true]),
        )
      : update.status === "declined"
        ? Object.fromEntries(
            invitation.eligibleEvents.map((eventKey) => [eventKey, false]),
          )
        : {};

  const updatedInvitation: InvitationGroup = {
    ...invitation,
    rsvp: {
      ...invitation.rsvp,
      status: update.status,
      eventAttendance,
      updatedAt: now,
      updatedBy: "admin",
      submittedAt:
        update.status === "pending"
          ? invitation.rsvp.submittedAt
          : invitation.rsvp.submittedAt || now,
    },
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B1: check all write errors
    const { error: rsvpError } = await supabase.from("rsvps").upsert({
      id: invitation.rsvp.id,
      invitation_group_id: invitation.id,
      status: updatedInvitation.rsvp.status,
      event_attendance: updatedInvitation.rsvp.eventAttendance,
      message: updatedInvitation.rsvp.message,
      submitted_at: updatedInvitation.rsvp.submittedAt,
      updated_at: now,
      updated_by: "admin",
    });
    if (rsvpError) throw new Error(rsvpError.message);

    // B10: when admin overrides status to "declined", delete the travel plan
    if (update.status === "declined") {
      const { error: travelError } = await supabase
        .from("travel_plans")
        .delete()
        .eq("invitation_group_id", invitation.id);
      if (travelError) {
        console.error("[updateRsvpByAdmin] Failed to delete travel plan on decline:", travelError.message);
      }
    }

    const { error: historyError } = await supabase.from("rsvp_history").insert({
      invitation_group_id: invitation.id,
      status: updatedInvitation.rsvp.status,
      changed_by: "admin",
      changed_at: now,
      snapshot: updatedInvitation.rsvp,
    });
    if (historyError) throw new Error(historyError.message);
  } else {
    const store = previewStore();
    // B10: delete travel plan on decline in preview store
    if (update.status === "declined") {
      store.travelPlans = store.travelPlans.filter(
        (plan) => plan.invitationGroupId !== invitation.id,
      );
    }
    store.invitations = store.invitations.map((item) =>
      item.id === invitation.id ? updatedInvitation : item,
    );
    store.history.unshift({
      id: `history-${Date.now()}`,
      invitationGroupId: invitation.id,
      status: updatedInvitation.rsvp.status,
      changedBy: "admin",
      changedAt: now,
      snapshot: updatedInvitation.rsvp,
    });
  }

  return updatedInvitation;
}

export async function submitTravelPlan(submission: TravelPlanSubmission) {
  const invitation = await getInvitationByCode(submission.code);
  if (!invitation) throw new Error("Invitation not found.");
  if (invitation.flow !== "overseas" && invitation.flow !== "family") {
    throw new Error(
      "Travel plans are only available for overseas and family guests.",
    );
  }
  if (invitation.rsvp.status === "pending") {
    throw new Error("Please submit your RSVP before travel plans.");
  }
  if (invitation.rsvp.status === "declined") {
    throw new Error("Travel plans are only needed for attending guests.");
  }

  const now = new Date().toISOString();
  const accommodationOption =
    invitation.flow === "family" ? "assign_roommates" : submission.accommodationOption;
  const preferredRoommates =
    invitation.flow === "family"
      ? undefined
      : submission.preferredRoommates?.trim() || undefined;
  const travelPlan: TravelPlan = {
    id: `travel-${invitation.id}`,
    invitationGroupId: invitation.id,
    arrivalAt: new Date(submission.arrivalAt).toISOString(),
    departureAt: new Date(submission.departureAt).toISOString(),
    accommodationOption,
    preferredRoommates,
    submittedAt: now,
    updatedAt: now,
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    const { data, error } = await supabase
      .from("travel_plans")
      .upsert(
        {
          invitation_group_id: invitation.id,
          arrival_at: travelPlan.arrivalAt,
          departure_at: travelPlan.departureAt,
          accommodation_option: travelPlan.accommodationOption,
          preferred_roommates: travelPlan.preferredRoommates || null,
          submitted_at: travelPlan.submittedAt,
          updated_at: travelPlan.updatedAt,
        },
        { onConflict: "invitation_group_id" },
      )
      .select(
        "id,invitation_group_id,arrival_at,departure_at,accommodation_option,preferred_roommates,submitted_at,updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return mapTravelPlanRow(data);
  }

  const store = previewStore();
  const existingIndex = store.travelPlans.findIndex(
    (item) => item.invitationGroupId === invitation.id,
  );
  if (existingIndex >= 0) {
    store.travelPlans[existingIndex] = {
      ...travelPlan,
      id: store.travelPlans[existingIndex].id,
      submittedAt: store.travelPlans[existingIndex].submittedAt,
    };
    return clone(store.travelPlans[existingIndex]);
  }
  store.travelPlans.unshift(travelPlan);
  return clone(travelPlan);
}

export async function getTravelPlans(): Promise<TravelPlan[]> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    const { data, error } = await supabase
      .from("travel_plans")
      .select(
        "id,invitation_group_id,arrival_at,departure_at,accommodation_option,preferred_roommates,submitted_at,updated_at",
      )
      .order("arrival_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(mapTravelPlanRow);
  }
  return clone(
    [...previewStore().travelPlans].sort(
      (a, b) => new Date(a.arrivalAt).getTime() - new Date(b.arrivalAt).getTime(),
    ),
  );
}

export async function getTravelPlanByInvitationId(
  invitationGroupId: string,
): Promise<TravelPlan | null> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    const { data, error } = await supabase
      .from("travel_plans")
      .select(
        "id,invitation_group_id,arrival_at,departure_at,accommodation_option,preferred_roommates,submitted_at,updated_at",
      )
      .eq("invitation_group_id", invitationGroupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return mapTravelPlanRow(data);
    return null;
  }
  const plan = previewStore().travelPlans.find(
    (item) => item.invitationGroupId === invitationGroupId,
  );
  return plan ? clone(plan) : null;
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const content = await getDraftContent();
  const invitations = await getInvitations();
  const history = await getHistory();
  const messageLogs = await getAdminMessageLogs();
  const travelPlans = await getTravelPlans();

  // B7: compute distinct invite-open count from events table when Supabase is available
  let distinctOpenCount: number | undefined;
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (supabase) {
      const { data: openData, error: openError } = await supabase
        .from("invite_open_events")
        .select("invitation_group_id");
      if (!openError && openData) {
        const uniqueGroupIds = new Set(
          openData
            .map((row: { invitation_group_id: string }) => row.invitation_group_id)
            .filter(Boolean),
        );
        distinctOpenCount = uniqueGroupIds.size;
      }
    }
  }

  return {
    content,
    invitations,
    history,
    messageLogs,
    travelPlans,
    stats: calculateStats(invitations, history, distinctOpenCount),
  };
}

export async function getInvitations(): Promise<InvitationGroup[]> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B2: throw on query error — do NOT fall through to preview store
    const { data, error } = await supabase
      .from("invitation_groups")
      .select("*,rsvps(*),guests(*)")
      .order("group_name");
    if (error) throw new Error(error.message);
    return data.map(mapInvitationRow);
  }
  return clone(previewStore().invitations);
}

export async function getHistory(): Promise<RsvpHistoryItem[]> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B2: throw on query error — do NOT fall through to preview store
    const { data, error } = await supabase
      .from("rsvp_history")
      .select("id,invitation_group_id,status,changed_by,changed_at,snapshot")
      .order("changed_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data.map((item) => ({
      id: String(item.id),
      invitationGroupId: String(item.invitation_group_id),
      status: item.status as RsvpHistoryItem["status"],
      changedBy: item.changed_by as RsvpHistoryItem["changedBy"],
      changedAt: String(item.changed_at),
      snapshot: item.snapshot,
    }));
  }
  return clone(previewStore().history);
}

export async function getAdminMessageLogs(): Promise<AdminMessageLog[]> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B2: throw on query error — do NOT fall through to preview store
    const { data, error } = await supabase
      .from("admin_message_logs")
      .select(
        "id,invitation_group_id,channel,message_type,recipient,message_preview,sent_at,sent_by",
      )
      .order("sent_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data.map(mapAdminMessageLogRow);
  }
  return clone(previewStore().messageLogs);
}

export async function recordAdminWhatsAppMessage({
  invitationGroupId,
  messageType,
  recipient,
  messagePreview,
  sentBy,
}: {
  invitationGroupId: string;
  messageType: AdminWhatsAppMessageType;
  recipient?: string;
  messagePreview?: string;
  sentBy?: string;
}) {
  if (!invitationGroupId) throw new Error("Invitation group is required.");

  const log: AdminMessageLog = {
    id: `message-${Date.now()}`,
    invitationGroupId,
    channel: "whatsapp",
    messageType,
    recipient,
    messagePreview,
    sentAt: new Date().toISOString(),
    sentBy,
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    const { data, error } = await supabase
      .from("admin_message_logs")
      .insert({
        invitation_group_id: invitationGroupId,
        channel: "whatsapp",
        message_type: messageType,
        recipient: recipient || null,
        message_preview: messagePreview || null,
        sent_by: sentBy || null,
      })
      .select(
        "id,invitation_group_id,channel,message_type,recipient,message_preview,sent_at,sent_by",
      )
      .single();
    if (error) throw new Error(error.message);
    return mapAdminMessageLogRow(data);
  }

  previewStore().messageLogs.unshift(log);
  return clone(log);
}

export async function upsertInvitationFromCsvRows(rows: GuestCsvRow[]) {
  const groups = new Map<string, GuestCsvRow[]>();
  for (const row of rows) {
    groups.set(row.groupName, [...(groups.get(row.groupName) || []), row]);
  }

  const created: InvitationGroup[] = [];
  for (const [groupName, groupRows] of groups.entries()) {
    const first = groupRows[0];
    const id = `invite-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const code = generateInviteCode(groupName);
    const guests: Guest[] = groupRows.map((row, index) => ({
      id: `${id}-guest-${index + 1}`,
      invitationGroupId: id,
      name: row.name,
      mealPreference: "unset",
    }));
    const group: InvitationGroup = {
      id,
      code,
      greeting: first.greeting,
      groupName,
      phone: first.phone,
      email: first.email,
      maxGuests: maxGuestsForInvitation(first.maxGuests, guests),
      side: first.side,
      source: "admin",
      flow: first.flow,
      privateNotes:
        first.privateNotesEn || first.privateNotesId
          ? {
              en: first.privateNotesEn || "",
              id: first.privateNotesId || first.privateNotesEn || "",
            }
          : undefined,
      eligibleEvents: first.events,
      rsvp: {
        id: `rsvp-${id}`,
        invitationGroupId: id,
        status: "pending",
        eventAttendance: {},
      },
      guests,
    };
    created.push(group);
  }

  // B14/F5: collect per-row failures so the caller can surface partial-success details.
  const rowErrors: Array<{ groupName: string; message: string }> = [];

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");

    for (const group of created) {
      const groupInsert = {
        code: group.code,
        greeting: group.greeting,
        group_name: group.groupName,
        phone: group.phone,
        email: group.email,
        max_guests: group.maxGuests,
        side: group.side,
        source: "admin",
        private_notes: privateNotesPayload(group.privateNotes, group.flow),
        eligible_events: group.eligibleEvents,
      };
      let { data: insertedGroup, error } = await supabase
        .from("invitation_groups")
        .insert({ ...groupInsert, flow: group.flow })
        .select("id")
        .single();
      if (error && missingFlowColumn(error)) {
        // B8: log loudly when missing columns
        console.error(
          "[upsertInvitationFromCsvRows] WARNING: flow/max_guests columns appear missing. " +
            "Schema migration is required. Retrying without these columns.",
        );
        const { max_guests, ...legacyGroupInsert } = groupInsert;
        const retry = await supabase
          .from("invitation_groups")
          .insert(legacyGroupInsert)
          .select("id")
          .single();
        insertedGroup = retry.data;
        error = retry.error;
      }
      if (error) {
        // B6: on code unique-violation, retry with suffix
        if (error.code === "23505") {
          let retried: typeof insertedGroup = null;
          let retryError: typeof error | null = error;
          for (let attempt = 1; attempt <= 3; attempt++) {
            const suffixedCode = `${group.code}-${attempt}`;
            const retryResult = await supabase
              .from("invitation_groups")
              .insert({ ...groupInsert, code: suffixedCode, flow: group.flow })
              .select("id")
              .single();
            retried = retryResult.data;
            retryError = retryResult.error;
            if (!retryError) {
              group.code = suffixedCode;
              break;
            }
          }
          if (retryError || !retried?.id) {
            rowErrors.push({ groupName: group.groupName, message: `Code collision: ${retryError?.message || "unknown"}` });
            continue;
          }
          insertedGroup = retried;
        } else {
          rowErrors.push({ groupName: group.groupName, message: error.message });
          continue;
        }
      }
      if (!insertedGroup?.id) {
        rowErrors.push({ groupName: group.groupName, message: "No id returned after group insert." });
        continue;
      }

      group.id = String(insertedGroup.id);
      group.rsvp.invitationGroupId = group.id;
      group.guests = group.guests.map((guest) => ({
        ...guest,
        invitationGroupId: group.id,
      }));

      // B1 + B14: check RSVP insert error; on failure, best-effort delete orphan group
      const { error: rsvpError } = await supabase.from("rsvps").insert({
        invitation_group_id: group.id,
        status: "pending",
        event_attendance: {},
      });
      if (rsvpError) {
        rowErrors.push({ groupName: group.groupName, message: `RSVP insert failed: ${rsvpError.message}` });
        // Best-effort cleanup of orphan group
        await supabase.from("invitation_groups").delete().eq("id", group.id).then(() => {});
        continue;
      }

      // B1 + B14: check guest insert error
      const { error: guestsError } = await supabase.from("guests").insert(
        group.guests.map((guest) => ({
          invitation_group_id: group.id,
          name: guest.name,
          meal_preference: guest.mealPreference,
        })),
      );
      if (guestsError) {
        rowErrors.push({ groupName: group.groupName, message: `Guests insert failed: ${guestsError.message}` });
        continue;
      }
    }

  } else {
    previewStore().invitations.unshift(...created);
  }

  // B14/F5: return rowErrors alongside created instead of throwing, so the API
  // can distinguish partial success and return both the snapshot and error details.
  return { created, rowErrors };
}

export async function upsertInvitationByAdmin(input: AdminInvitationUpsert) {
  const normalized = normalizeAdminInvitationInput(input);
  const existing = normalized.code
    ? await getInvitationByCode(normalized.code)
    : null;
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");

    let invitationId = existing?.id;
    let code =
      existing?.code ||
      normalized.code ||
      generateInviteCode(normalized.groupName);

    if (existing) {
      const groupUpdate = {
        greeting: normalized.greeting,
        group_name: normalized.groupName,
        phone: normalized.phone || null,
        email: normalized.email || null,
        max_guests: normalized.maxGuests,
        side: normalized.side,
        private_notes: privateNotesPayload(
          normalized.privateNotes as InvitationGroup["privateNotes"],
          normalized.flow,
        ),
        eligible_events: normalized.eligibleEvents,
        travel_overrides: normalized.travelOverrides ?? null,
        updated_at: now,
      };
      let { error } = await supabase
        .from("invitation_groups")
        .update({ ...groupUpdate, flow: normalized.flow })
        .eq("id", existing.id);
      if (error && missingTravelOverridesColumn(error)) {
        // travel_overrides migration not applied yet — retry without it.
        console.error(
          "[upsertInvitationByAdmin] WARNING: travel_overrides column missing. " +
            "Run the 20260613 migration. Saving without travel overrides.",
        );
        const { travel_overrides, ...rest } = groupUpdate;
        const retry = await supabase
          .from("invitation_groups")
          .update({ ...rest, flow: normalized.flow })
          .eq("id", existing.id);
        error = retry.error;
      }
      if (error && missingFlowColumn(error)) {
        // B8: log loudly when missing columns
        console.error(
          "[upsertInvitationByAdmin] WARNING: flow/max_guests columns appear missing from invitation_groups. " +
            "Schema migration is required. Retrying without these columns.",
        );
        const { max_guests, travel_overrides, ...legacyGroupUpdate } =
          groupUpdate;
        const retry = await supabase
          .from("invitation_groups")
          .update(legacyGroupUpdate)
          .eq("id", existing.id);
        error = retry.error;
      }
      if (error) throw new Error(error.message);
    } else {
      const groupInsert = {
        code,
        greeting: normalized.greeting,
        group_name: normalized.groupName,
        phone: normalized.phone,
        email: normalized.email,
        max_guests: normalized.maxGuests,
        side: normalized.side,
        source: "admin",
        private_notes: privateNotesPayload(
          normalized.privateNotes as InvitationGroup["privateNotes"],
          normalized.flow,
        ),
        eligible_events: normalized.eligibleEvents,
        travel_overrides: normalized.travelOverrides ?? null,
      };
      let { data, error } = await supabase
        .from("invitation_groups")
        .insert({ ...groupInsert, flow: normalized.flow })
        .select("id,code")
        .single();
      if (error && missingTravelOverridesColumn(error)) {
        // travel_overrides migration not applied yet — retry without it.
        console.error(
          "[upsertInvitationByAdmin] WARNING: travel_overrides column missing. " +
            "Run the 20260613 migration. Saving without travel overrides.",
        );
        const { travel_overrides, ...rest } = groupInsert;
        const retry = await supabase
          .from("invitation_groups")
          .insert({ ...rest, flow: normalized.flow })
          .select("id,code")
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (error && missingFlowColumn(error)) {
        // B8: log loudly when missing columns
        console.error(
          "[upsertInvitationByAdmin] WARNING: flow/max_guests columns appear missing from invitation_groups. " +
            "Schema migration is required. Retrying without these columns.",
        );
        const { max_guests, travel_overrides, ...legacyGroupInsert } =
          groupInsert;
        const retry = await supabase
          .from("invitation_groups")
          .insert(legacyGroupInsert)
          .select("id,code")
          .single();
        data = retry.data;
        error = retry.error;
      }
      if (error || !data?.id)
        throw new Error(error?.message || "Unable to create invitation group.");
      invitationId = String(data.id);
      code = String(data.code);
      const { error: rsvpError } = await supabase.from("rsvps").insert({
        invitation_group_id: invitationId,
        status: "pending",
        event_attendance: {},
      });
      if (rsvpError) throw new Error(rsvpError.message);
    }

    if (!invitationId) throw new Error("Invitation group was not found.");
    const existingGuestIds = new Set(
      existing?.guests.map((guest) => guest.id) || [],
    );
    const keptGuestIds = new Set(
      normalized.guests.map((guest) => guest.id).filter(Boolean),
    );
    const guestIdsToDelete = [...existingGuestIds].filter(
      (id) => !keptGuestIds.has(id),
    );

    if (guestIdsToDelete.length) {
      const { error } = await supabase
        .from("guests")
        .delete()
        .in("id", guestIdsToDelete);
      if (error) throw new Error(error.message);
    }

    for (const guest of normalized.guests) {
      if (guest.id && existingGuestIds.has(guest.id)) {
        const { error } = await supabase
          .from("guests")
          .update({
            name: guest.name,
            meal_preference: guest.mealPreference,
          })
          .eq("id", guest.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("guests").insert({
          invitation_group_id: invitationId,
          name: guest.name,
          meal_preference: guest.mealPreference,
        });
        if (error) throw new Error(error.message);
      }
    }

    const latest = await getInvitationByCode(code);
    if (!latest)
      throw new Error("Invitation was saved but could not be loaded.");
    const adjustedRsvp = adjustRsvpForEligibleEvents(
      latest,
      normalized.eligibleEvents,
    );
    const { error: rsvpError } = await supabase.from("rsvps").upsert({
      id: adjustedRsvp.id,
      invitation_group_id: latest.id,
      status: adjustedRsvp.status,
      event_attendance: adjustedRsvp.eventAttendance,
      message: adjustedRsvp.message,
      submitted_at: adjustedRsvp.submittedAt,
      updated_at: adjustedRsvp.updatedAt,
      updated_by: adjustedRsvp.updatedBy,
    });
    if (rsvpError) throw new Error(rsvpError.message);

    return (await getInvitationByCode(code)) || latest;
  }

  const store = previewStore();
  if (existing) {
    const updatedGuests: Guest[] = normalized.guests.map((guest, index) => ({
      id: guest.id || `${existing.id}-guest-${Date.now()}-${index + 1}`,
      invitationGroupId: existing.id,
      name: guest.name,
      mealPreference: guest.mealPreference,
    }));
    const updated: InvitationGroup = {
      ...existing,
      greeting: normalized.greeting,
      groupName: normalized.groupName,
      phone: normalized.phone,
      email: normalized.email,
      maxGuests: normalized.maxGuests || normalized.guests.length,
      side: normalized.side,
      flow: normalized.flow,
      privateNotes: normalized.privateNotes as InvitationGroup["privateNotes"],
      eligibleEvents: normalized.eligibleEvents,
      rsvp: adjustRsvpForEligibleEvents(existing, normalized.eligibleEvents),
      guests: updatedGuests,
      travelOverrides: normalized.travelOverrides,
    };
    store.invitations = store.invitations.map((item) =>
      item.id === existing.id ? updated : item,
    );
    return clone(updated);
  }

  const id = `invite-admin-${normalized.groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const code = generateInviteCode(normalized.groupName);
  const invitation: InvitationGroup = {
    id,
    code,
    greeting: normalized.greeting,
    groupName: normalized.groupName,
    phone: normalized.phone,
    email: normalized.email,
    maxGuests: normalized.maxGuests || normalized.guests.length,
    side: normalized.side,
    source: "admin",
    flow: normalized.flow,
    privateNotes: normalized.privateNotes as InvitationGroup["privateNotes"],
    eligibleEvents: normalized.eligibleEvents,
    rsvp: {
      id: `rsvp-${id}`,
      invitationGroupId: id,
      status: "pending",
      eventAttendance: {},
    },
    guests: normalized.guests.map((guest, index) => ({
      id: `${id}-guest-${index + 1}`,
      invitationGroupId: id,
      name: guest.name,
      mealPreference: guest.mealPreference,
    })),
    travelOverrides: normalized.travelOverrides,
  };
  store.invitations.unshift(invitation);
  return clone(invitation);
}

export async function deleteInvitationByAdmin(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) throw new Error("Invitation code is required.");

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B1: check delete error
    const { error } = await supabase
      .from("invitation_groups")
      .delete()
      .eq("code", normalizedCode);
    if (error) throw new Error(error.message);
    return;
  }

  const store = previewStore();
  const invitation = store.invitations.find(
    (item) => item.code === normalizedCode,
  );
  store.invitations = store.invitations.filter(
    (item) => item.code !== normalizedCode,
  );
  if (invitation) {
    store.history = store.history.filter(
      (item) => item.invitationGroupId !== invitation.id,
    );
  }
}

export async function addMediaAsset(
  asset: MediaAsset,
  options: { applyToContent?: boolean } = {},
) {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B1: check media insert error
    const { data, error } = await supabase
      .from("media_assets")
      .insert({
        kind: asset.kind,
        url: asset.url,
        alt: asset.alt,
        sort_order: asset.sortOrder,
        is_published: asset.isPublished,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data?.id) asset.id = String(data.id);
  }

  if (options.applyToContent === false) return asset;

  const content = await getDraftContent();
  const updatedContent = applyMediaToContent(content, asset);
  await saveDraftContent(updatedContent);
  return asset;
}

export async function removeMediaAssetFromDraft(
  kind: MediaAsset["kind"],
  url: string,
) {
  const content = await getDraftContent();
  const fallbackHero =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    weddingContent.heroImageUrl;
  const fallbackInvitation =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    weddingContent.invitationImageUrl;
  const fallbackStory =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    weddingContent.storyImageUrl;
  const fallbackTravelHero =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    content.invitationImageUrl ||
    weddingContent.travelHeroImageUrl;
  const fallbackTravelForm =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    content.storyImageUrl ||
    weddingContent.travelFormImageUrl;
  const fallbackTravelAirport =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    weddingContent.travelAirportImageUrl;
  const fallbackTravelAccommodation =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    weddingContent.travelAccommodationImageUrl;
  const fallbackDiscoverHero =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    content.travelHeroImageUrl ||
    weddingContent.discoverHeroImageUrl;
  const fallbackDiscoverIntro =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    content.invitationImageUrl ||
    weddingContent.discoverIntroImageUrl;
  const fallbackDiscoverFood =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    content.storyImageUrl ||
    weddingContent.discoverFoodImageUrl;
  const fallbackDiscoverSupper =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    content.travelFormImageUrl ||
    weddingContent.discoverSupperImageUrl;
  const fallbackDiscoverCafe =
    content.gallery.find((asset) => asset.url !== url)?.url ||
    content.heroImageUrl ||
    weddingContent.discoverCafeImageUrl;
  const shouldResetHero = content.heroImageUrl === url;
  const shouldResetInvitation = content.invitationImageUrl === url;
  const shouldResetStory = content.storyImageUrl === url;
  const shouldResetTravelHero = content.travelHeroImageUrl === url;
  const shouldResetTravelAirport = content.travelAirportImageUrl === url;
  const shouldResetTravelAccommodation =
    content.travelAccommodationImageUrl === url;
  const shouldResetTravelForm = content.travelFormImageUrl === url;
  const shouldResetDiscoverHero = content.discoverHeroImageUrl === url;
  const shouldResetDiscoverIntro = content.discoverIntroImageUrl === url;
  const shouldResetDiscoverFood = content.discoverFoodImageUrl === url;
  const shouldResetDiscoverSupper = content.discoverSupperImageUrl === url;
  const shouldResetDiscoverCafe = content.discoverCafeImageUrl === url;
  const updatedContent: WeddingContent = {
    ...content,
    heroImageUrl: shouldResetHero ? fallbackHero : content.heroImageUrl,
    invitationImageUrl: shouldResetInvitation
      ? fallbackInvitation
      : content.invitationImageUrl,
    storyImageUrl: shouldResetStory ? fallbackStory : content.storyImageUrl,
    travelHeroImageUrl: shouldResetTravelHero
      ? fallbackTravelHero
      : content.travelHeroImageUrl,
    travelAirportImageUrl: shouldResetTravelAirport
      ? fallbackTravelAirport
      : content.travelAirportImageUrl,
    travelAccommodationImageUrl: shouldResetTravelAccommodation
      ? fallbackTravelAccommodation
      : content.travelAccommodationImageUrl,
    travelFormImageUrl: shouldResetTravelForm
      ? fallbackTravelForm
      : content.travelFormImageUrl,
    discoverHeroImageUrl: shouldResetDiscoverHero
      ? fallbackDiscoverHero
      : content.discoverHeroImageUrl,
    discoverIntroImageUrl: shouldResetDiscoverIntro
      ? fallbackDiscoverIntro
      : content.discoverIntroImageUrl,
    discoverFoodImageUrl: shouldResetDiscoverFood
      ? fallbackDiscoverFood
      : content.discoverFoodImageUrl,
    discoverSupperImageUrl: shouldResetDiscoverSupper
      ? fallbackDiscoverSupper
      : content.discoverSupperImageUrl,
    discoverCafeImageUrl: shouldResetDiscoverCafe
      ? fallbackDiscoverCafe
      : content.discoverCafeImageUrl,
    musicUrl:
      kind === "music" && content.musicUrl === url
        ? undefined
        : content.musicUrl,
    discoverMedan: {
      ...content.discoverMedan,
      sections: content.discoverMedan.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          imageUrl: item.imageUrl === url ? undefined : item.imageUrl,
        })),
      })),
    },
    gallery:
      kind === "gallery"
        ? content.gallery.filter((asset) => asset.url !== url)
        : content.gallery,
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B1: check delete error
    const { error } = await supabase.from("media_assets").delete().eq("url", url);
    if (error) throw new Error(error.message);
  }

  await saveDraftContent(updatedContent);
  return updatedContent;
}

export async function setDraftImageSlot(
  slot:
    | "hero"
    | "invitation"
    | "story"
    | "travelHero"
    | "travelAirport"
    | "travelAccommodation"
    | "travelForm"
    | "discoverHero"
    | "discoverIntro"
    | "discoverFood"
    | "discoverSupper"
    | "discoverCafe"
    | "discoverPlaces"
    | "bridePortrait"
    | "groomPortrait",
  url: string,
) {
  const content = await getDraftContent();
  const updatedContent: WeddingContent = {
    ...content,
    heroImageUrl: slot === "hero" ? url : content.heroImageUrl,
    invitationImageUrl:
      slot === "invitation" ? url : content.invitationImageUrl,
    storyImageUrl: slot === "story" ? url : content.storyImageUrl,
    travelHeroImageUrl:
      slot === "travelHero" ? url : content.travelHeroImageUrl,
    travelAirportImageUrl:
      slot === "travelAirport" ? url : content.travelAirportImageUrl,
    travelAccommodationImageUrl:
      slot === "travelAccommodation"
        ? url
        : content.travelAccommodationImageUrl,
    travelFormImageUrl:
      slot === "travelForm" ? url : content.travelFormImageUrl,
    discoverHeroImageUrl:
      slot === "discoverHero" ? url : content.discoverHeroImageUrl,
    discoverIntroImageUrl:
      slot === "discoverIntro" ? url : content.discoverIntroImageUrl,
    discoverFoodImageUrl:
      slot === "discoverFood" ? url : content.discoverFoodImageUrl,
    discoverSupperImageUrl:
      slot === "discoverSupper" ? url : content.discoverSupperImageUrl,
    discoverCafeImageUrl:
      slot === "discoverCafe" ? url : content.discoverCafeImageUrl,
  };
  await saveDraftContent(updatedContent);
  return updatedContent;
}

export async function setDraftImageCrop(
  slot: ImageCropSlot,
  crop: ImageCropSettings,
) {
  const content = await getDraftContent();
  const updatedContent: WeddingContent = {
    ...content,
    imageCrops: {
      ...content.imageCrops,
      [slot]: normalizeImageCrop(crop),
    },
  };
  await saveDraftContent(updatedContent);
  return updatedContent;
}

export async function setDraftDiscoverItemImage(itemId: string, url: string) {
  const content = await getDraftContent();
  const updatedContent: WeddingContent = {
    ...content,
    discoverMedan: {
      ...content.discoverMedan,
      sections: content.discoverMedan.sections.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.id === itemId ? { ...item, imageUrl: url } : item,
        ),
      })),
    },
  };
  await saveDraftContent(updatedContent);
  return updatedContent;
}

export async function setDraftHeroImage(url: string) {
  return setDraftImageSlot("hero", url);
}

function applyMediaToContent(
  content: WeddingContent,
  asset: MediaAsset,
): WeddingContent {
  if (asset.kind === "hero") {
    return {
      ...content,
      heroImageUrl: asset.url,
    };
  }

  if (asset.kind === "music") {
    return {
      ...content,
      musicUrl: asset.url,
    };
  }

  return {
    ...content,
    gallery: [
      ...content.gallery.filter((item) => item.url !== asset.url),
      asset,
    ].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}
// B7: inviteOpenCount is the authoritative COUNT(DISTINCT invitation_group_id)
// from invite_open_events, passed by getAdminSnapshot when Supabase is available.
// In preview mode (no Supabase) it is undefined, so we fall back to the in-memory
// openedAt flag on each invitation object.
export function calculateStats(
  invitations: InvitationGroup[],
  history: RsvpHistoryItem[] = [],
  inviteOpenCount?: number,
): DashboardStats {
  const totalInvitedPeople = invitations.reduce(
    (sum, invitation) => sum + invitation.guests.length,
    0,
  );
  const attendingInvitations = invitations.filter(
    (item) => item.rsvp.status === "attending",
  ).length;
  const declinedInvitations = invitations.filter(
    (item) => item.rsvp.status === "declined",
  ).length;
  const pendingInvitations = invitations.filter(
    (item) => item.rsvp.status === "pending",
  ).length;
  const mealCounts = invitations
    .flatMap((item) => item.guests)
    .reduce(
      (acc, guest) => {
        if (guest.mealPreference === "vegetarian") acc.vegetarianMeals += 1;
        if (guest.mealPreference === "non_vegetarian")
          acc.nonVegetarianMeals += 1;
        return acc;
      },
      { vegetarianMeals: 0, nonVegetarianMeals: 0 },
    );
  const completed = invitations.length - pendingInvitations;
  // B7: prefer the authoritative distinct-open count; fall back to in-memory flag.
  // The old `|| history.length` fallback used an unrelated number — removed.
  const inviteOpens =
    inviteOpenCount !== undefined
      ? inviteOpenCount
      : invitations.filter((item) => item.openedAt).length;
  return {
    totalInvitedPeople,
    totalInvitations: invitations.length,
    attendingInvitations,
    declinedInvitations,
    pendingInvitations,
    inviteOpens,
    rsvpCompletionRate: invitations.length
      ? Math.round((completed / invitations.length) * 100)
      : 0,
    ...mealCounts,
  };
}

function mapInvitationRow(row: any): InvitationGroup {
  const rsvp = Array.isArray(row.rsvps) ? row.rsvps[0] : row.rsvps;
  const guests = (row.guests || []).map((guest: any) => ({
    id: String(guest.id),
    invitationGroupId: String(row.id),
    name: String(guest.name),
    mealPreference: guest.meal_preference || "unset",
  }));
  return {
    id: String(row.id),
    code: String(row.code),
    greeting: String(row.greeting),
    groupName: String(row.group_name),
    phone: row.phone || undefined,
    email: row.email || undefined,
    maxGuests: maxGuestsForInvitation(row.max_guests, guests),
    side: row.side || "joint",
    source: row.source || "admin",
    flow: rowInvitationFlow(row),
    privateNotes: publicPrivateNotes(row.private_notes),
    eligibleEvents: (row.eligible_events || ["dinner"]) as EventKey[],
    openedAt: row.opened_at || undefined,
    rsvp: {
      id: String(rsvp?.id || `rsvp-${row.id}`),
      invitationGroupId: String(row.id),
      status: rsvp?.status || "pending",
      eventAttendance: rsvp?.event_attendance || {},
      message: rsvp?.message || undefined,
      submittedAt: rsvp?.submitted_at || undefined,
      updatedAt: rsvp?.updated_at || undefined,
      updatedBy: rsvp?.updated_by || undefined,
    },
    guests,
    travelOverrides: normalizeTravelOverrides(row.travel_overrides),
  };
}

/**
 * Validate the travel_overrides JSONB blob into a typed object. Returns
 * undefined when nothing usable is present so callers fall back to defaults.
 * The column may not exist yet on older schemas — row.travel_overrides is
 * simply undefined then, which this handles.
 */
function normalizeTravelOverrides(
  raw: unknown,
): InvitationTravelOverrides | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const result: InvitationTravelOverrides = {};
  if (typeof o.transportProvided === "boolean")
    result.transportProvided = o.transportProvided;
  if (typeof o.accommodationProvided === "boolean")
    result.accommodationProvided = o.accommodationProvided;
  if (typeof o.checkInDate === "string" && o.checkInDate)
    result.checkInDate = o.checkInDate;
  if (typeof o.checkOutDate === "string" && o.checkOutDate)
    result.checkOutDate = o.checkOutDate;
  return Object.keys(result).length ? result : undefined;
}

function mapTravelPlanRow(row: any): TravelPlan {
  return {
    id: String(row.id),
    invitationGroupId: String(row.invitation_group_id),
    arrivalAt: String(row.arrival_at),
    departureAt: String(row.departure_at),
    accommodationOption: row.accommodation_option,
    preferredRoommates: row.preferred_roommates || undefined,
    submittedAt: String(row.submitted_at),
    updatedAt: String(row.updated_at),
  };
}

function mapAdminMessageLogRow(row: any): AdminMessageLog {
  return {
    id: String(row.id),
    invitationGroupId: String(row.invitation_group_id),
    channel: "whatsapp",
    messageType: row.message_type as AdminWhatsAppMessageType,
    recipient: row.recipient || undefined,
    messagePreview: row.message_preview || undefined,
    sentAt: String(row.sent_at),
    sentBy: row.sent_by || undefined,
  };
}

async function getExistingInvitationCodes() {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase client unavailable");
    // B2: throw on query error — do NOT silently fall back to preview data
    const { data, error } = await supabase
      .from("invitation_groups")
      .select("code");
    if (error) throw new Error(error.message);
    return data?.map((row) => String(row.code)) || [];
  }
  return previewStore().invitations.map((invitation) => invitation.code);
}
