import type {
  AdminGuestInput,
  AdminInvitationUpsert,
  AdminSnapshot,
  AdminRsvpUpdate,
  DashboardStats,
  EventKey,
  Guest,
  GuestCsvRow,
  InvitationGroup,
  MediaAsset,
  RsvpHistoryItem,
  RsvpSubmission,
  SelfRegistrationSubmission,
  WeddingContent
} from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/env";
import {
  buildNameInviteCode,
  ensureEligibleEvents,
  eventKeys,
  generateInviteCode,
  hasAtLeastOneAttendingEvent
} from "@/lib/rsvp";
import { sampleHistory, sampleInvitations } from "@/lib/seed";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { weddingContent } from "@/lib/wedding-content";

interface PreviewStore {
  content: WeddingContent;
  draftContent: WeddingContent;
  invitations: InvitationGroup[];
  history: RsvpHistoryItem[];
  openEvents: number;
}

const globalStore = globalThis as typeof globalThis & { __ejPreviewStore?: PreviewStore };

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
      openEvents: sampleInvitations.filter((item) => item.openedAt).length
    };
  }
  return globalStore.__ejPreviewStore;
}

function normalizeWeddingContent(content: Partial<WeddingContent>): WeddingContent {
  return {
    ...weddingContent,
    ...content,
    parents: {
      ...weddingContent.parents,
      ...content.parents
    },
    venue: {
      ...weddingContent.venue,
      ...content.venue
    },
    heroImageUrl: content.heroImageUrl || weddingContent.heroImageUrl,
    invitationImageUrl: content.invitationImageUrl || weddingContent.invitationImageUrl,
    storyImageUrl: content.storyImageUrl || weddingContent.storyImageUrl,
    gallery: content.gallery || weddingContent.gallery,
    events: content.events || weddingContent.events,
    notes: content.notes || weddingContent.notes
  };
}

function cleanOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizePrivateNotes(notes: AdminInvitationUpsert["privateNotes"]) {
  const en = cleanOptionalText(notes?.en);
  const id = cleanOptionalText(notes?.id);
  if (!en && !id) return undefined;
  return {
    en: en || id || "",
    id: id || en || ""
  };
}

function normalizeAdminGuest(guest: AdminGuestInput, index: number): AdminGuestInput {
  const name = cleanOptionalText(guest.name);
  if (!name) throw new Error(`Guest ${index + 1} needs a name.`);
  return {
    id: guest.id,
    name,
    mealPreference: mealPreferenceOrUnset(guest.mealPreference)
  };
}

function mealPreferenceOrUnset(value: unknown): Guest["mealPreference"] {
  return value === "vegetarian" || value === "non_vegetarian" || value === "unset" ? value : "unset";
}

function normalizeAdminInvitationInput(input: AdminInvitationUpsert): AdminInvitationUpsert {
  const groupName = cleanOptionalText(input.groupName);
  const greeting = cleanOptionalText(input.greeting);
  if (!groupName) throw new Error("Group name is required.");
  if (!greeting) throw new Error("Greeting is required.");

  const eligibleEvents = input.eligibleEvents.filter((eventKey): eventKey is EventKey =>
    eventKeys.includes(eventKey)
  );
  if (!eligibleEvents.length) throw new Error("Select at least one eligible event.");

  const guests = input.guests.map(normalizeAdminGuest);
  if (!guests.length) throw new Error("Add at least one guest.");

  return {
    code: input.code ? input.code.trim().toUpperCase() : undefined,
    groupName,
    greeting,
    phone: cleanOptionalText(input.phone),
    email: cleanOptionalText(input.email),
    side: input.side === "groom" || input.side === "bride" || input.side === "joint" ? input.side : "joint",
    privateNotes: normalizePrivateNotes(input.privateNotes),
    eligibleEvents,
    guests
  };
}

function adjustRsvpForEligibleEvents(
  invitation: InvitationGroup,
  eligibleEvents: EventKey[]
): InvitationGroup["rsvp"] {
  if (invitation.rsvp.status === "pending") {
    return {
      ...invitation.rsvp,
      eventAttendance: {}
    };
  }

  if (invitation.rsvp.status === "declined") {
    return {
      ...invitation.rsvp,
      eventAttendance: Object.fromEntries(eligibleEvents.map((eventKey) => [eventKey, false]))
    };
  }

  const existingAttendance = ensureEligibleEvents(invitation.rsvp.eventAttendance, eligibleEvents);
  const eventAttendance = hasAtLeastOneAttendingEvent(existingAttendance)
    ? existingAttendance
    : Object.fromEntries(eligibleEvents.map((eventKey) => [eventKey, true]));
  return {
    ...invitation.rsvp,
    eventAttendance
  };
}

export async function getPublishedContent(): Promise<WeddingContent> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    const { data } =
      (await supabase
        ?.from("content_versions")
        .select("content,published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle()) || {};
    if (data?.content) {
      return {
        ...normalizeWeddingContent(data.content as Partial<WeddingContent>),
        publishedAt: data.published_at || undefined
      };
    }
  }
  return normalizeWeddingContent(clone(previewStore().content));
}

export async function getDraftContent(): Promise<WeddingContent> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    const { data } =
      (await supabase
        ?.from("content_versions")
        .select("content")
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()) || {};
    if (data?.content) return normalizeWeddingContent(data.content as Partial<WeddingContent>);
  }
  return normalizeWeddingContent(clone(previewStore().draftContent));
}

export async function saveDraftContent(content: WeddingContent) {
  const normalizedContent = normalizeWeddingContent(content);
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    await supabase?.from("content_versions").insert({
      status: "draft",
      content: normalizedContent,
      updated_at: new Date().toISOString()
    });
  } else {
    previewStore().draftContent = clone(normalizedContent);
  }
  return getDraftContent();
}

export async function publishDraftContent() {
  const draft = await getDraftContent();
  const published = {
    ...draft,
    publishedAt: new Date().toISOString()
  };
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    await supabase?.from("content_versions").insert({
      status: "published",
      content: published,
      published_at: published.publishedAt,
      updated_at: published.publishedAt
    });
    const mediaUrls = publishedMediaUrls(published);
    if (mediaUrls.length) {
      await supabase?.from("media_assets").update({ is_published: true }).in("url", mediaUrls);
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
        content.musicUrl,
        ...content.gallery.map((asset) => asset.url)
      ].filter((url): url is string => Boolean(url))
    )
  );
}

export async function getInvitationByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    const { data } =
      (await supabase
        ?.from("invitation_groups")
        .select(
          "id,code,greeting,group_name,phone,email,side,source,private_notes,eligible_events,opened_at,rsvps(*),guests(*)"
        )
        .eq("code", normalizedCode)
        .maybeSingle()) || {};
    if (data) return mapInvitationRow(data);
    return null;
  }

  return clone(previewStore().invitations.find((invite) => invite.code === normalizedCode) || null);
}

export async function recordInviteOpen(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    const { data } = (await supabase
      ?.from("invitation_groups")
      .select("id")
      .eq("code", normalizedCode)
      .maybeSingle()) || { data: null };
    if (data?.id) {
      await supabase?.from("invite_open_events").insert({
        invitation_group_id: data.id,
        opened_at: new Date().toISOString()
      });
    }
    return;
  }

  const store = previewStore();
  const invitation = store.invitations.find((item) => item.code === normalizedCode);
  if (invitation && !invitation.openedAt) {
    invitation.openedAt = new Date().toISOString();
    store.openEvents += 1;
  }
}

export async function submitRsvp(submission: RsvpSubmission, changedBy: "guest" | "admin" = "guest") {
  const invitation = await getInvitationByCode(submission.code);
  if (!invitation) throw new Error("Invitation not found");

  const eventAttendance = ensureEligibleEvents(submission.eventAttendance, invitation.eligibleEvents);
  const status = submission.status === "attending" && !hasAtLeastOneAttendingEvent(eventAttendance) ? "declined" : submission.status;
  const updatedAt = new Date().toISOString();
  const updatedInvitation: InvitationGroup = {
    ...invitation,
    rsvp: {
      ...invitation.rsvp,
      status,
      eventAttendance,
      message: submission.message,
      submittedAt: invitation.rsvp.submittedAt || updatedAt,
      updatedAt,
      updatedBy: changedBy
    },
    guests: invitation.guests.map((guest) => ({
      ...guest,
      mealPreference: submission.mealPreferences[guest.id] || guest.mealPreference
    }))
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    await supabase?.from("rsvps").upsert({
      id: invitation.rsvp.id,
      invitation_group_id: invitation.id,
      status: updatedInvitation.rsvp.status,
      event_attendance: updatedInvitation.rsvp.eventAttendance,
      message: updatedInvitation.rsvp.message,
      submitted_at: updatedInvitation.rsvp.submittedAt,
      updated_at: updatedAt,
      updated_by: changedBy
    });
    for (const guest of updatedInvitation.guests) {
      await supabase?.from("guests").update({ meal_preference: guest.mealPreference }).eq("id", guest.id);
    }
    await supabase?.from("rsvp_history").insert({
      invitation_group_id: invitation.id,
      status: updatedInvitation.rsvp.status,
      changed_by: changedBy,
      changed_at: updatedAt,
      snapshot: updatedInvitation.rsvp
    });
  } else {
    const store = previewStore();
    store.invitations = store.invitations.map((item) => (item.id === invitation.id ? updatedInvitation : item));
    store.history.unshift({
      id: `history-${Date.now()}`,
      invitationGroupId: invitation.id,
      status: updatedInvitation.rsvp.status,
      changedBy,
      changedAt: updatedAt,
      snapshot: updatedInvitation.rsvp
    });
  }

  return updatedInvitation;
}

export async function createSelfRegisteredInvitation(submission: SelfRegistrationSubmission) {
  const now = new Date().toISOString();
  const idSeed = submission.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "guest";
  const id = `invite-self-${idSeed}-${Date.now()}`;
  const code = buildNameInviteCode(submission.name, await getExistingInvitationCodes());
  const guests: Guest[] = Array.from({ length: submission.guestCount }, (_, index) => ({
    id: `${id}-guest-${index + 1}`,
    invitationGroupId: id,
    name: index === 0 ? submission.name : `${submission.name} Guest ${index + 1}`,
    mealPreference: submission.status === "attending" ? submission.mealPreference : "unset"
  }));

  const eventAttendance = ensureEligibleEvents(submission.eventAttendance, eventKeys);
  const status =
    submission.status === "attending" && !hasAtLeastOneAttendingEvent(eventAttendance)
      ? "declined"
      : submission.status;

  let invitation: InvitationGroup = {
    id,
    code,
    greeting: `Dear ${submission.name}`,
    groupName: submission.name,
    phone: submission.phone,
    side: "joint",
    source: "generic",
    privateNotes: {
      en: "Self-registered through the JESSmarriED generic invitation code.",
      id: "Mendaftar sendiri melalui kode undangan umum JESSmarriED."
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
      updatedBy: "guest"
    },
    guests
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    const { data: insertedGroup, error } =
      (await supabase
        ?.from("invitation_groups")
        .insert({
          code: invitation.code,
          greeting: invitation.greeting,
          group_name: invitation.groupName,
          phone: invitation.phone,
          side: invitation.side,
          source: invitation.source,
          private_notes: invitation.privateNotes,
          eligible_events: invitation.eligibleEvents,
          opened_at: invitation.openedAt
        })
        .select("id")
        .single()) || {};
    if (error || !insertedGroup?.id) throw new Error(error?.message || "Unable to create self-registration.");

    invitation = {
      ...invitation,
      id: String(insertedGroup.id),
      rsvp: {
        ...invitation.rsvp,
        invitationGroupId: String(insertedGroup.id)
      },
      guests: invitation.guests.map((guest) => ({
        ...guest,
        invitationGroupId: String(insertedGroup.id)
      }))
    };

    const { data: insertedRsvp } =
      (await supabase
        ?.from("rsvps")
        .insert({
          invitation_group_id: invitation.id,
          status: invitation.rsvp.status,
          event_attendance: invitation.rsvp.eventAttendance,
          message: invitation.rsvp.message,
          submitted_at: invitation.rsvp.submittedAt,
          updated_at: invitation.rsvp.updatedAt,
          updated_by: "guest"
        })
        .select("id")
        .single()) || {};
    if (insertedRsvp?.id) {
      invitation.rsvp.id = String(insertedRsvp.id);
    }

    const { data: insertedGuests } =
      (await supabase
        ?.from("guests")
        .insert(
          invitation.guests.map((guest) => ({
            invitation_group_id: invitation.id,
            name: guest.name,
            meal_preference: guest.mealPreference
          }))
        )
        .select("id,name,meal_preference")) || {};
    if (insertedGuests?.length) {
      invitation.guests = insertedGuests.map((guest) => ({
        id: String(guest.id),
        invitationGroupId: invitation.id,
        name: String(guest.name),
        mealPreference: guest.meal_preference || submission.mealPreference
      }));
    }

    await supabase?.from("rsvp_history").insert({
      invitation_group_id: invitation.id,
      status: invitation.rsvp.status,
      changed_by: "guest",
      changed_at: now,
      snapshot: invitation.rsvp
    });
  } else {
    const store = previewStore();
    store.invitations.unshift(invitation);
    store.history.unshift({
      id: `history-${Date.now()}`,
      invitationGroupId: invitation.id,
      status: invitation.rsvp.status,
      changedBy: "guest",
      changedAt: now,
      snapshot: invitation.rsvp
    });
  }

  return invitation;
}

export async function updateRsvpByAdmin(update: AdminRsvpUpdate) {
  const invitation = await getInvitationByCode(update.code);
  if (!invitation) throw new Error("Invitation not found");

  const now = new Date().toISOString();
  const eventAttendance =
    update.status === "attending"
      ? Object.fromEntries(invitation.eligibleEvents.map((eventKey) => [eventKey, true]))
      : update.status === "declined"
        ? Object.fromEntries(invitation.eligibleEvents.map((eventKey) => [eventKey, false]))
        : {};

  const updatedInvitation: InvitationGroup = {
    ...invitation,
    rsvp: {
      ...invitation.rsvp,
      status: update.status,
      eventAttendance,
      updatedAt: now,
      updatedBy: "admin",
      submittedAt: update.status === "pending" ? invitation.rsvp.submittedAt : invitation.rsvp.submittedAt || now
    }
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    await supabase?.from("rsvps").upsert({
      id: invitation.rsvp.id,
      invitation_group_id: invitation.id,
      status: updatedInvitation.rsvp.status,
      event_attendance: updatedInvitation.rsvp.eventAttendance,
      message: updatedInvitation.rsvp.message,
      submitted_at: updatedInvitation.rsvp.submittedAt,
      updated_at: now,
      updated_by: "admin"
    });
    await supabase?.from("rsvp_history").insert({
      invitation_group_id: invitation.id,
      status: updatedInvitation.rsvp.status,
      changed_by: "admin",
      changed_at: now,
      snapshot: updatedInvitation.rsvp
    });
  } else {
    const store = previewStore();
    store.invitations = store.invitations.map((item) => (item.id === invitation.id ? updatedInvitation : item));
    store.history.unshift({
      id: `history-${Date.now()}`,
      invitationGroupId: invitation.id,
      status: updatedInvitation.rsvp.status,
      changedBy: "admin",
      changedAt: now,
      snapshot: updatedInvitation.rsvp
    });
  }

  return updatedInvitation;
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const content = await getDraftContent();
  const invitations = await getInvitations();
  const history = await getHistory();
  return {
    content,
    invitations,
    history,
    stats: calculateStats(invitations, history)
  };
}

export async function getInvitations(): Promise<InvitationGroup[]> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    const { data } =
      (await supabase
        ?.from("invitation_groups")
        .select("id,code,greeting,group_name,phone,email,side,source,private_notes,eligible_events,opened_at,rsvps(*),guests(*)")
        .order("group_name")) || {};
    if (data) return data.map(mapInvitationRow);
  }
  return clone(previewStore().invitations);
}

export async function getHistory(): Promise<RsvpHistoryItem[]> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    const { data } =
      (await supabase
        ?.from("rsvp_history")
        .select("id,invitation_group_id,status,changed_by,changed_at,snapshot")
        .order("changed_at", { ascending: false })
        .limit(100)) || {};
    if (data) {
      return data.map((item) => ({
        id: String(item.id),
        invitationGroupId: String(item.invitation_group_id),
        status: item.status as RsvpHistoryItem["status"],
        changedBy: item.changed_by as RsvpHistoryItem["changedBy"],
        changedAt: String(item.changed_at),
        snapshot: item.snapshot
      }));
    }
  }
  return clone(previewStore().history);
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
      mealPreference: "unset"
    }));
    const group: InvitationGroup = {
      id,
      code,
      greeting: first.greeting,
      groupName,
      phone: first.phone,
      email: first.email,
      side: first.side,
      privateNotes:
        first.privateNotesEn || first.privateNotesId
          ? {
              en: first.privateNotesEn || "",
              id: first.privateNotesId || first.privateNotesEn || ""
            }
          : undefined,
      eligibleEvents: first.events,
      rsvp: {
        id: `rsvp-${id}`,
        invitationGroupId: id,
        status: "pending",
        eventAttendance: {}
      },
      guests
    };
    created.push(group);
  }

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    for (const group of created) {
      const { data: insertedGroup, error } =
        (await supabase
          ?.from("invitation_groups")
          .insert({
            code: group.code,
            greeting: group.greeting,
            group_name: group.groupName,
            phone: group.phone,
            email: group.email,
            side: group.side,
            source: "admin",
            private_notes: group.privateNotes,
            eligible_events: group.eligibleEvents
          })
          .select("id")
          .single()) || {};
      if (error || !insertedGroup?.id) throw new Error(error?.message || "Unable to create invitation group.");
      group.id = String(insertedGroup.id);
      group.rsvp.invitationGroupId = group.id;
      group.guests = group.guests.map((guest) => ({ ...guest, invitationGroupId: group.id }));

      await supabase?.from("rsvps").insert({
        invitation_group_id: group.id,
        status: "pending",
        event_attendance: {}
      });
      await supabase?.from("guests").insert(
        group.guests.map((guest) => ({
          invitation_group_id: group.id,
          name: guest.name,
          meal_preference: guest.mealPreference
        }))
      );
    }
  } else {
    previewStore().invitations.unshift(...created);
  }

  return created;
}

export async function upsertInvitationByAdmin(input: AdminInvitationUpsert) {
  const normalized = normalizeAdminInvitationInput(input);
  const existing = normalized.code ? await getInvitationByCode(normalized.code) : null;
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase is not configured.");

    let invitationId = existing?.id;
    let code = existing?.code || normalized.code || generateInviteCode(normalized.groupName);

    if (existing) {
      const { error } = await supabase
        .from("invitation_groups")
        .update({
          greeting: normalized.greeting,
          group_name: normalized.groupName,
          phone: normalized.phone || null,
          email: normalized.email || null,
          side: normalized.side,
          private_notes: normalized.privateNotes || null,
          eligible_events: normalized.eligibleEvents,
          updated_at: now
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase
        .from("invitation_groups")
        .insert({
          code,
          greeting: normalized.greeting,
          group_name: normalized.groupName,
          phone: normalized.phone,
          email: normalized.email,
          side: normalized.side,
          source: "admin",
          private_notes: normalized.privateNotes,
          eligible_events: normalized.eligibleEvents
        })
        .select("id,code")
        .single();
      if (error || !data?.id) throw new Error(error?.message || "Unable to create invitation group.");
      invitationId = String(data.id);
      code = String(data.code);
      const { error: rsvpError } = await supabase.from("rsvps").insert({
        invitation_group_id: invitationId,
        status: "pending",
        event_attendance: {}
      });
      if (rsvpError) throw new Error(rsvpError.message);
    }

    if (!invitationId) throw new Error("Invitation group was not found.");
    const existingGuestIds = new Set(existing?.guests.map((guest) => guest.id) || []);
    const keptGuestIds = new Set(normalized.guests.map((guest) => guest.id).filter(Boolean));
    const guestIdsToDelete = [...existingGuestIds].filter((id) => !keptGuestIds.has(id));

    if (guestIdsToDelete.length) {
      const { error } = await supabase.from("guests").delete().in("id", guestIdsToDelete);
      if (error) throw new Error(error.message);
    }

    for (const guest of normalized.guests) {
      if (guest.id && existingGuestIds.has(guest.id)) {
        const { error } = await supabase
          .from("guests")
          .update({
            name: guest.name,
            meal_preference: guest.mealPreference
          })
          .eq("id", guest.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("guests").insert({
          invitation_group_id: invitationId,
          name: guest.name,
          meal_preference: guest.mealPreference
        });
        if (error) throw new Error(error.message);
      }
    }

    const latest = await getInvitationByCode(code);
    if (!latest) throw new Error("Invitation was saved but could not be loaded.");
    const adjustedRsvp = adjustRsvpForEligibleEvents(latest, normalized.eligibleEvents);
    const { error: rsvpError } = await supabase
      .from("rsvps")
      .upsert({
        id: adjustedRsvp.id,
        invitation_group_id: latest.id,
        status: adjustedRsvp.status,
        event_attendance: adjustedRsvp.eventAttendance,
        message: adjustedRsvp.message,
        submitted_at: adjustedRsvp.submittedAt,
        updated_at: adjustedRsvp.updatedAt,
        updated_by: adjustedRsvp.updatedBy
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
      mealPreference: guest.mealPreference
    }));
    const updated: InvitationGroup = {
      ...existing,
      greeting: normalized.greeting,
      groupName: normalized.groupName,
      phone: normalized.phone,
      email: normalized.email,
      side: normalized.side,
      privateNotes: normalized.privateNotes as InvitationGroup["privateNotes"],
      eligibleEvents: normalized.eligibleEvents,
      rsvp: adjustRsvpForEligibleEvents(existing, normalized.eligibleEvents),
      guests: updatedGuests
    };
    store.invitations = store.invitations.map((item) => (item.id === existing.id ? updated : item));
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
    side: normalized.side,
    source: "admin",
    privateNotes: normalized.privateNotes as InvitationGroup["privateNotes"],
    eligibleEvents: normalized.eligibleEvents,
    rsvp: {
      id: `rsvp-${id}`,
      invitationGroupId: id,
      status: "pending",
      eventAttendance: {}
    },
    guests: normalized.guests.map((guest, index) => ({
      id: `${id}-guest-${index + 1}`,
      invitationGroupId: id,
      name: guest.name,
      mealPreference: guest.mealPreference
    }))
  };
  store.invitations.unshift(invitation);
  return clone(invitation);
}

export async function deleteInvitationByAdmin(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) throw new Error("Invitation code is required.");

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    const { error } = (await supabase?.from("invitation_groups").delete().eq("code", normalizedCode)) || {};
    if (error) throw new Error(error.message);
    return;
  }

  const store = previewStore();
  const invitation = store.invitations.find((item) => item.code === normalizedCode);
  store.invitations = store.invitations.filter((item) => item.code !== normalizedCode);
  if (invitation) {
    store.history = store.history.filter((item) => item.invitationGroupId !== invitation.id);
  }
}

export async function addMediaAsset(asset: MediaAsset) {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    const { data, error } =
      (await supabase
        ?.from("media_assets")
        .insert({
          kind: asset.kind,
          url: asset.url,
          alt: asset.alt,
          sort_order: asset.sortOrder,
          is_published: asset.isPublished
        })
        .select("id")
        .single()) || {};
    if (error) throw new Error(error.message);
    if (data?.id) asset.id = String(data.id);
  }

  const content = await getDraftContent();
  const updatedContent = applyMediaToContent(content, asset);
  await saveDraftContent(updatedContent);
  return asset;
}

export async function removeMediaAssetFromDraft(kind: MediaAsset["kind"], url: string) {
  const content = await getDraftContent();
  const fallbackHero = content.gallery.find((asset) => asset.url !== url)?.url || weddingContent.heroImageUrl;
  const fallbackInvitation =
    content.gallery.find((asset) => asset.url !== url)?.url || weddingContent.invitationImageUrl;
  const fallbackStory = content.gallery.find((asset) => asset.url !== url)?.url || weddingContent.storyImageUrl;
  const shouldResetHero = content.heroImageUrl === url;
  const shouldResetInvitation = content.invitationImageUrl === url;
  const shouldResetStory = content.storyImageUrl === url;
  const updatedContent: WeddingContent = {
    ...content,
    heroImageUrl: shouldResetHero ? fallbackHero : content.heroImageUrl,
    invitationImageUrl: shouldResetInvitation ? fallbackInvitation : content.invitationImageUrl,
    storyImageUrl: shouldResetStory ? fallbackStory : content.storyImageUrl,
    musicUrl: kind === "music" && content.musicUrl === url ? undefined : content.musicUrl,
    gallery:
      kind === "gallery"
        ? content.gallery.filter((asset) => asset.url !== url)
        : content.gallery
  };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    await supabase?.from("media_assets").delete().eq("url", url);
  }

  await saveDraftContent(updatedContent);
  return updatedContent;
}

export async function setDraftImageSlot(slot: "hero" | "invitation" | "story", url: string) {
  const content = await getDraftContent();
  const updatedContent: WeddingContent = {
    ...content,
    heroImageUrl: slot === "hero" ? url : content.heroImageUrl,
    invitationImageUrl: slot === "invitation" ? url : content.invitationImageUrl,
    storyImageUrl: slot === "story" ? url : content.storyImageUrl
  };
  await saveDraftContent(updatedContent);
  return updatedContent;
}

export async function setDraftHeroImage(url: string) {
  return setDraftImageSlot("hero", url);
}

function applyMediaToContent(content: WeddingContent, asset: MediaAsset): WeddingContent {
  if (asset.kind === "hero") {
    return {
      ...content,
      heroImageUrl: asset.url
    };
  }

  if (asset.kind === "music") {
    return {
      ...content,
      musicUrl: asset.url
    };
  }

  return {
    ...content,
    gallery: [...content.gallery.filter((item) => item.url !== asset.url), asset].sort(
      (a, b) => a.sortOrder - b.sortOrder
    )
  };
}
export function calculateStats(invitations: InvitationGroup[], history: RsvpHistoryItem[] = []): DashboardStats {
  const totalInvitedPeople = invitations.reduce((sum, invitation) => sum + invitation.guests.length, 0);
  const attendingInvitations = invitations.filter((item) => item.rsvp.status === "attending").length;
  const declinedInvitations = invitations.filter((item) => item.rsvp.status === "declined").length;
  const pendingInvitations = invitations.filter((item) => item.rsvp.status === "pending").length;
  const mealCounts = invitations.flatMap((item) => item.guests).reduce(
    (acc, guest) => {
      if (guest.mealPreference === "vegetarian") acc.vegetarianMeals += 1;
      if (guest.mealPreference === "non_vegetarian") acc.nonVegetarianMeals += 1;
      return acc;
    },
    { vegetarianMeals: 0, nonVegetarianMeals: 0 }
  );
  const completed = invitations.length - pendingInvitations;
  return {
    totalInvitedPeople,
    totalInvitations: invitations.length,
    attendingInvitations,
    declinedInvitations,
    pendingInvitations,
    inviteOpens: invitations.filter((item) => item.openedAt).length || history.length,
    rsvpCompletionRate: invitations.length ? Math.round((completed / invitations.length) * 100) : 0,
    ...mealCounts
  };
}

function mapInvitationRow(row: any): InvitationGroup {
  const rsvp = Array.isArray(row.rsvps) ? row.rsvps[0] : row.rsvps;
  return {
    id: String(row.id),
    code: String(row.code),
    greeting: String(row.greeting),
    groupName: String(row.group_name),
    phone: row.phone || undefined,
    email: row.email || undefined,
    side: row.side || "joint",
    source: row.source || "admin",
    privateNotes: row.private_notes || undefined,
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
      updatedBy: rsvp?.updated_by || undefined
    },
    guests: (row.guests || []).map((guest: any) => ({
      id: String(guest.id),
      invitationGroupId: String(row.id),
      name: String(guest.name),
      mealPreference: guest.meal_preference || "unset"
    }))
  };
}

async function getExistingInvitationCodes() {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceClient();
    const { data } = (await supabase?.from("invitation_groups").select("code")) || {};
    return data?.map((row) => String(row.code)) || [];
  }
  return previewStore().invitations.map((invitation) => invitation.code);
}
