"use client";

import {
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  FileText,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  Music2,
  Plus,
  Save,
  Search,
  Send,
  Luggage,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { ChangeEvent, ElementType, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { DiscoverMedanEditor } from "@/components/admin/discover-medan-editor";
import {
  defaultImageCrop,
  FRAME_RATIOS,
  normalizeImageCrop,
  normalizeImageFocal,
} from "@/lib/image-crop";
import {
  buildAdminWhatsAppMessage,
  buildWhatsAppMessageUrl,
  eventKeys,
  mealPreferences,
} from "@/lib/rsvp";
import type {
  AdminGuestInput,
  AdminInvitationUpsert,
  AdminMessageLog,
  AdminProfile,
  AdminSnapshot,
  AdminWhatsAppMessageType,
  BrideGroomFrame,
  EventKey,
  GuestSide,
  ImageCropSettings,
  ImageCropSlot,
  ImageFocalPoint,
  ImageFrameRatio,
  InvitationGroup,
  InvitationTravelOverrides,
  MediaAsset,
  OpeningAnimation,
  PublicInviteFlow,
  PublicInviteType,
  RsvpStatus,
  TravelAccommodationOption,
  TravelPlan,
  WeddingContent,
} from "@/lib/types";

type Tab =
  | "dashboard"
  | "guests"
  | "rsvp"
  | "content"
  | "media"
  | "analytics"
  | "travel"
  | "export";
type ImageSlot =
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
  | "groomPortrait"
  | "ogImage";

const tabs: { id: Tab; label: string; icon: ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "guests", label: "Guests", icon: Users },
  { id: "rsvp", label: "RSVP", icon: MessageCircle },
  { id: "content", label: "Content", icon: FileText },
  { id: "media", label: "Photos & Music", icon: ImagePlus },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "travel", label: "Travel", icon: Luggage },
  { id: "export", label: "Export", icon: Download },
];

const eventLabels: Record<EventKey, string> = {
  holy_matrimony: "Buddhist Wedding Ceremony",
  tea_lunch: "Lunch Buffet",
  dinner: "Dinner Reception",
};

// The events a guest actually selected — NOT the events they were invited to
// (eligibleEvents), which is what these cells used to show for everyone.
// Missing attendance keys default to true, matching the RSVP form's initial
// state for eligible events.
function attendanceEventLabels(invitation: InvitationGroup): string {
  if (invitation.rsvp.status === "declined") return "—";
  const keys =
    invitation.rsvp.status === "attending"
      ? invitation.eligibleEvents.filter(
          (key) => invitation.rsvp.eventAttendance?.[key] !== false,
        )
      : invitation.eligibleEvents;
  if (!keys.length) return "—";
  return keys.map((key) => eventLabels[key]).join(", ");
}

const imageSlotLabels: Record<ImageSlot, string> = {
  hero: "Hero",
  invitation: "Invitation Intro",
  story: "Our Story",
  travelHero: "Travel Hero",
  travelAirport: "Kualanamu Airport",
  travelAccommodation: "Accommodation Hotel",
  travelForm: "Before Travel Form",
  discoverHero: "Discover Hero",
  discoverIntro: "Discover Intro",
  discoverFood: "Local Food",
  discoverSupper: "Snacks & Supper",
  discoverCafe: "Cafes",
  discoverPlaces: "Places to Visit",
  bridePortrait: "Bride Portrait",
  groomPortrait: "Groom Portrait",
  ogImage: "Link Preview (WhatsApp/OG)",
};

const accommodationOptionLabels: Record<TravelAccommodationOption, string> = {
  specific_roommates: "Specific roommates",
  assign_roommates: "Assign roommates",
  own_accommodation: "Own accommodation",
};

const publicInviteFlowLabels: Record<PublicInviteFlow, string> = {
  generic: "General",
  overseas: "Overseas",
  family: "Family",
};

const whatsappMessageLabels: Record<AdminWhatsAppMessageType, string> = {
  invitation: "Invitation",
  rsvp_confirmation: "RSVP confirmation",
  travel_plans: "Travel plans",
};

const maxBrowserUploadBytes = 35 * 1024 * 1024;
const maxServerImageBytes = 4 * 1024 * 1024;
const uploadTimeoutMs = 90_000;

function imageUploadWidth(kind: MediaAsset["kind"], slot?: ImageSlot) {
  if (kind === "hero") return 3000;
  if (slot === "hero" || slot === "travelHero" || slot === "discoverHero") {
    return 3000;
  }
  // Wide enough that a 3x focal-point zoom still has ~850px of source pixels.
  return 2560;
}

function isHeicImage(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

function webFileName(fileName: string, mimeType: string) {
  const base =
    fileName
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "photo";
  const ext = mimeType === "image/jpeg" ? "jpg" : "webp";
  return `${base}-optimized.${ext}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function loadImageForCompression(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.decoding = "async";
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to read this image."));
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressImageInBrowser(
  file: File,
  kind: MediaAsset["kind"],
  slot?: ImageSlot,
) {
  const image = await loadImageForCompression(file);
  const maxWidth = imageUploadWidth(kind, slot);
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to optimize this image.");
  context.drawImage(image, 0, 0, width, height);

  // Max-quality browser pre-pass so the server (sharp q100) does the real
  // encode without compounding compression. Falls to lower steps only if the
  // file would exceed the upload limit.
  const qualities = kind === "hero" || slot === "hero"
    ? [1, 0.92, 0.85]
    : [1, 0.9, 0.82];

  // Try WebP first (smaller files); fall back to JPEG which is universally supported.
  let bestBlob: Blob | null = null;
  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    // If the browser returned a blob but it isn't actually WebP (some browsers
    // silently produce PNG), treat it as unsupported and break to the JPEG path.
    if (blob && blob.type === "image/webp") {
      bestBlob = blob;
      if (blob.size <= maxServerImageBytes) break;
    } else {
      break;
    }
  }

  // Fall back to JPEG if WebP was not produced or was too large at all quality levels.
  if (!bestBlob || bestBlob.type !== "image/webp") {
    bestBlob = null;
    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (!blob) continue;
      bestBlob = blob;
      if (blob.size <= maxServerImageBytes) break;
    }
  }

  if (!bestBlob) throw new Error("Unable to optimize this image.");

  const mimeType = bestBlob.type === "image/webp" ? "image/webp" : "image/jpeg";
  return new File([bestBlob], webFileName(file.name, mimeType), {
    type: mimeType,
    lastModified: Date.now(),
  });
}

async function prepareMediaFileForUpload(
  file: File,
  kind: MediaAsset["kind"],
  slot?: ImageSlot,
) {
  if (kind === "music") return file;
  if (isHeicImage(file)) {
    throw new Error(
      "HEIC/HEIF photos are not supported yet. Please export the photo as JPG or PNG and upload again.",
    );
  }
  if (file.size > maxBrowserUploadBytes) {
    throw new Error("This photo is too large. Please upload an image below 35MB.");
  }
  const optimized = await compressImageInBrowser(file, kind, slot);
  if (optimized.size > maxServerImageBytes) {
    throw new Error(
      "This photo is still too large after optimization. Please upload a smaller JPG or PNG.",
    );
  }
  return optimized;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), uploadTimeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Upload timed out. Please try a smaller image.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}


export function AdminDashboard({
  admin,
  snapshot,
}: {
  admin: AdminProfile;
  snapshot: AdminSnapshot;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [currentSnapshot, setCurrentSnapshot] = useState(snapshot);
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <p className="eyebrow">Wedding Admin</p>
        <h1 className="serif" style={{ fontSize: "2rem", marginTop: 6 }}>
          Edward & Jessica
        </h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {admin.displayName}
        </p>
        <nav className="admin-nav" aria-label="Admin navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            );
          })}
          <button type="button" onClick={logout}>
            <LogOut size={17} />
            Logout
          </button>
        </nav>
      </aside>
      <section className="admin-main">
        <AdminHeader tab={activeTab} />
        {activeTab === "dashboard" ? (
          <DashboardView snapshot={currentSnapshot} />
        ) : null}
        {activeTab === "guests" ? (
          <GuestsView
            snapshot={currentSnapshot}
            onSnapshot={setCurrentSnapshot}
          />
        ) : null}
        {activeTab === "rsvp" ? (
          <RsvpView
            snapshot={currentSnapshot}
            onSnapshot={setCurrentSnapshot}
          />
        ) : null}
        {activeTab === "content" ? (
          <ContentView
            content={currentSnapshot.content}
            onContent={(content) =>
              setCurrentSnapshot((s) => ({ ...s, content }))
            }
          />
        ) : null}
        {activeTab === "media" ? (
          <MediaView
            content={currentSnapshot.content}
            onContent={(content) =>
              setCurrentSnapshot((snapshot) => ({ ...snapshot, content }))
            }
          />
        ) : null}
        {activeTab === "analytics" ? (
          <AnalyticsView snapshot={currentSnapshot} />
        ) : null}
        {activeTab === "travel" ? (
          <TravelView snapshot={currentSnapshot} />
        ) : null}
        {activeTab === "export" ? <ExportView /> : null}
      </section>
    </main>
  );
}

function AdminHeader({ tab }: { tab: Tab }) {
  const label = tabs.find((item) => item.id === tab)?.label || "Dashboard";
  return (
    <div className="section-heading" style={{ marginBottom: 22 }}>
      <div>
        <p className="eyebrow">Admin</p>
        <h2 className="title serif">{label}</h2>
      </div>
      <p className="muted">12 December 2026 · Grand City Hall Medan</p>
    </div>
  );
}

function DashboardView({ snapshot }: { snapshot: AdminSnapshot }) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <MetricGrid snapshot={snapshot} />
      <div className="admin-panel">
        <p className="eyebrow">Recent RSVP</p>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Status</th>
                <th>Events</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.invitations.slice(0, 6).map((invitation) => (
                <tr key={invitation.id}>
                  <td>{invitation.groupName}</td>
                  <td>
                    <StatusPill status={invitation.rsvp.status} />
                  </td>
                  <td>{attendanceEventLabels(invitation)}</td>
                  <td>{formatDateTime(invitation.rsvp.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricGrid({ snapshot }: { snapshot: AdminSnapshot }) {
  const stats = snapshot.stats;
  const metrics = [
    ["Invited", stats.totalInvitedPeople],
    ["Groups", stats.totalInvitations],
    ["Attending", stats.attendingInvitations],
    ["Pending", stats.pendingInvitations],
    ["Declined", stats.declinedInvitations],
    ["Opened", stats.inviteOpens],
    ["Complete", `${stats.rsvpCompletionRate}%`],
    ["Vegetarian", stats.vegetarianMeals],
  ];
  return (
    <div className="metric-grid">
      {metrics.map(([label, value]) => (
        <div className="metric" key={label}>
          <span className="muted">{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function GuestsView({
  snapshot,
  onSnapshot,
}: {
  snapshot: AdminSnapshot;
  onSnapshot: (snapshot: AdminSnapshot) => void;
}) {
  const [query, setQuery] = useState("");
  const [csv, setCsv] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<InvitationGroup | "new" | null>(null);
  const filtered = useFilteredInvitations(snapshot.invitations, query);

  async function importCsv() {
    setNotice("");
    const response = await fetch("/api/admin/guests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const json = (await response.json()) as {
      snapshot?: AdminSnapshot;
      error?: string;
    };
    // Partial success: snapshot returned alongside an error means some rows
    // failed (WP-B B14 aggregate error). Update the snapshot and surface
    // the failure details so admin can see exactly which rows were rejected.
    if (json.snapshot && json.error) {
      onSnapshot(json.snapshot);
      setNotice(`Import partially completed with errors: ${json.error}`);
      return;
    }
    if (!response.ok || !json.snapshot) {
      setNotice(json.error || "Import failed.");
      return;
    }
    onSnapshot(json.snapshot);
    setCsv("");
    setNotice("Guest list imported.");
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="admin-panel">
        <div className="grid-2">
          <label className="form-field">
            <span>
              <Search size={14} style={{ display: "inline", marginRight: 4 }} />
              Search guests
            </span>
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>
              <Upload size={14} style={{ display: "inline", marginRight: 4 }} />
              CSV import
            </span>
            <textarea
              className="textarea"
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              placeholder="groupName,greeting,name,phone,email,side,flow,events"
            />
          </label>
        </div>
        <button
          className="button button-muted"
          type="button"
          onClick={importCsv}
          disabled={!csv.trim()}
          style={{ marginTop: 14 }}
        >
          Import CSV
        </button>
        <a
          className="button button-muted"
          href="/api/admin/guests?format=template"
          download
          style={{ marginTop: 14, marginLeft: 10 }}
        >
          <Download size={17} />
          CSV Template
        </a>
        <button
          className="button button-muted"
          type="button"
          onClick={() => setEditing("new")}
          style={{ marginTop: 14, marginLeft: 10 }}
        >
          <Plus size={17} />
          New Group
        </button>
        {notice ? (
          <p className="muted" style={{ marginTop: 10 }}>
            {notice}
          </p>
        ) : null}
      </div>
      {editing ? (
        <GuestGroupEditor
          key={editing === "new" ? "new" : editing.code}
          invitation={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(nextSnapshot, invitation) => {
            onSnapshot(nextSnapshot);
            setEditing(invitation);
            setNotice("Guest group saved.");
          }}
          onDeleted={(nextSnapshot) => {
            onSnapshot(nextSnapshot);
            setEditing(null);
            setNotice("Guest group deleted.");
          }}
        />
      ) : null}
      <InvitationTable
        content={snapshot.content}
        invitations={filtered}
        messageLogs={snapshot.messageLogs}
        editableFlow
        onEdit={setEditing}
        onSnapshot={onSnapshot}
      />
    </div>
  );
}

function GuestGroupEditor({
  invitation,
  onCancel,
  onSaved,
  onDeleted,
}: {
  invitation: InvitationGroup | null;
  onCancel: () => void;
  onSaved: (snapshot: AdminSnapshot, invitation: InvitationGroup) => void;
  onDeleted: (snapshot: AdminSnapshot) => void;
}) {
  const [draft, setDraft] = useState<AdminInvitationUpsert>(
    invitation ? invitationToDraft(invitation) : emptyInvitationDraft(),
  );
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function setField<K extends keyof AdminInvitationUpsert>(
    key: K,
    value: AdminInvitationUpsert[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setGuest(index: number, update: Partial<AdminGuestInput>) {
    setDraft((current) => ({
      ...current,
      guests: current.guests.map((guest, guestIndex) =>
        guestIndex === index ? { ...guest, ...update } : guest,
      ),
    }));
  }

  function setTravelOverride<K extends keyof InvitationTravelOverrides>(
    key: K,
    value: InvitationTravelOverrides[K],
  ) {
    setDraft((current) => ({
      ...current,
      travelOverrides: { ...current.travelOverrides, [key]: value },
    }));
  }

  async function save() {
    setNotice("");
    setSaving(true);
    const response = await fetch("/api/admin/guests", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const json = (await response.json()) as {
      invitation?: InvitationGroup;
      snapshot?: AdminSnapshot;
      error?: string;
    };
    setSaving(false);
    if (!response.ok || !json.snapshot || !json.invitation) {
      setNotice(json.error || "Unable to save guest group.");
      return;
    }
    setDraft(invitationToDraft(json.invitation));
    onSaved(json.snapshot, json.invitation);
  }

  async function remove() {
    if (!draft.code) return;
    const confirmed = window.confirm(
      `Delete ${draft.groupName}? This also removes their RSVP.`,
    );
    if (!confirmed) return;

    setNotice("");
    setDeleting(true);
    const response = await fetch("/api/admin/guests", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: draft.code }),
    });
    const json = (await response.json()) as {
      snapshot?: AdminSnapshot;
      error?: string;
    };
    setDeleting(false);
    if (!response.ok || !json.snapshot) {
      setNotice(json.error || "Unable to delete guest group.");
      return;
    }
    onDeleted(json.snapshot);
  }

  return (
    <div className="admin-panel">
      <div className="section-heading" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">
            {draft.code ? `Edit ${draft.code}` : "New Guest Group"}
          </p>
          <h3 className="serif" style={{ fontSize: "2rem", marginTop: 6 }}>
            {draft.groupName || "Guest group"}
          </h3>
        </div>
        <button
          className="button button-muted"
          type="button"
          onClick={onCancel}
        >
          <X size={15} />
          Cancel
        </button>
      </div>

      <div className="grid-2">
        <label className="form-field">
          <span>Group name</span>
          <input
            className="input"
            value={draft.groupName}
            onChange={(event) => setField("groupName", event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Greeting</span>
          <input
            className="input"
            value={draft.greeting}
            onChange={(event) => setField("greeting", event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Phone / WhatsApp</span>
          <input
            className="input"
            value={draft.phone || ""}
            onChange={(event) => setField("phone", event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            value={draft.email || ""}
            onChange={(event) => setField("email", event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Side</span>
          <select
            className="select"
            value={draft.side}
            onChange={(event) =>
              setField("side", event.target.value as GuestSide)
            }
          >
            <option value="joint">Joint</option>
            <option value="groom">Groom</option>
            <option value="bride">Bride</option>
          </select>
        </label>
        <label className="form-field">
          <span>Invitation flow</span>
          <select
            className="select"
            value={draft.flow}
            onChange={(event) =>
              setField("flow", event.target.value as PublicInviteFlow)
            }
          >
            <option value="generic">General</option>
            <option value="overseas">Overseas</option>
            <option value="family">Family</option>
          </select>
        </label>
        <label className="form-field">
          <span>Max guests allowed</span>
          <input
            className="input"
            type="number"
            min={draft.guests.length || 1}
            max={10}
            value={draft.maxGuests || draft.guests.length || 1}
            onChange={(event) =>
              setField(
                "maxGuests",
                Math.min(
                  10,
                  Math.max(draft.guests.length || 1, Number(event.target.value) || 1),
                ),
              )
            }
          />
        </label>
      </div>

      <div style={{ marginTop: 18 }}>
        <p className="eyebrow">Eligible Events</p>
        <div className="grid-2" style={{ marginTop: 8 }}>
          {eventKeys.map((eventKey) => (
            <label className="choice-row" key={eventKey}>
              <span>{eventLabels[eventKey]}</span>
              <input
                type="checkbox"
                checked={draft.eligibleEvents.includes(eventKey)}
                onChange={(event) =>
                  setField(
                    "eligibleEvents",
                    event.target.checked
                      ? [...draft.eligibleEvents, eventKey]
                      : draft.eligibleEvents.filter(
                          (item) => item !== eventKey,
                        ),
                  )
                }
              />
            </label>
          ))}
        </div>
      </div>

      {draft.flow === "overseas" ? (
        <div style={{ marginTop: 18 }}>
          <p className="eyebrow">Overseas travel overrides</p>
          <p className="muted" style={{ marginTop: 4, marginBottom: 8 }}>
            Per-link overrides for this custom overseas invitation. Leave as-is
            for the standard overseas experience. (Guests still enter their own
            names &mdash; set &ldquo;Max guests&rdquo; above without pre-filling
            the extra names.)
          </p>
          <label className="choice-row">
            <span>Offer complimentary airport transport</span>
            <input
              type="checkbox"
              checked={draft.travelOverrides?.transportProvided !== false}
              onChange={(event) =>
                setTravelOverride("transportProvided", event.target.checked)
              }
            />
          </label>
          <label className="choice-row">
            <span>Offer complimentary accommodation</span>
            <input
              type="checkbox"
              checked={draft.travelOverrides?.accommodationProvided !== false}
              onChange={(event) =>
                setTravelOverride(
                  "accommodationProvided",
                  event.target.checked,
                )
              }
            />
          </label>
          {draft.travelOverrides?.accommodationProvided !== false ? (
            <div className="grid-2" style={{ marginTop: 10 }}>
              <label className="form-field">
                <span>Check-in date</span>
                <input
                  className="input"
                  type="date"
                  value={draft.travelOverrides?.checkInDate || ""}
                  onChange={(event) =>
                    setTravelOverride(
                      "checkInDate",
                      event.target.value || undefined,
                    )
                  }
                />
              </label>
              <label className="form-field">
                <span>Check-out date</span>
                <input
                  className="input"
                  type="date"
                  value={draft.travelOverrides?.checkOutDate || ""}
                  onChange={(event) =>
                    setTravelOverride(
                      "checkOutDate",
                      event.target.value || undefined,
                    )
                  }
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid-2" style={{ marginTop: 18 }}>
        <label className="form-field">
          <span>Private note EN</span>
          <textarea
            className="textarea"
            value={draft.privateNotes?.en || ""}
            onChange={(event) =>
              setField("privateNotes", {
                ...draft.privateNotes,
                en: event.target.value,
              })
            }
          />
        </label>
        <label className="form-field">
          <span>Private note ID</span>
          <textarea
            className="textarea"
            value={draft.privateNotes?.id || ""}
            onChange={(event) =>
              setField("privateNotes", {
                ...draft.privateNotes,
                id: event.target.value,
              })
            }
          />
        </label>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <p className="eyebrow">Guests</p>
          <button
            className="button button-muted"
            type="button"
            onClick={() =>
              setDraft((current) => {
                const guests = [
                  ...current.guests,
                  { name: "", mealPreference: "unset" as const },
                ];
                return {
                  ...current,
                  guests,
                  maxGuests: Math.max(current.maxGuests || 1, guests.length),
                };
              })
            }
          >
            <Plus size={15} />
            Add Guest
          </button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {draft.guests.map((guest, index) => (
            <div className="guest-meal-row" key={guest.id || `new-${index}`}>
              <input
                className="input"
                aria-label={`Guest ${index + 1} name`}
                value={guest.name}
                onChange={(event) =>
                  setGuest(index, { name: event.target.value })
                }
              />
              <select
                className="select"
                aria-label={`Guest ${index + 1} meal preference`}
                value={guest.mealPreference}
                onChange={(event) =>
                  setGuest(index, {
                    mealPreference: event.target
                      .value as AdminGuestInput["mealPreference"],
                  })
                }
                style={{ maxWidth: 210 }}
              >
                {mealPreferences.map((preference) => (
                  <option value={preference} key={preference}>
                    {preference === "vegetarian"
                      ? "Vegetarian"
                      : preference === "non_vegetarian"
                        ? "Non-vegetarian"
                        : "Unset"}
                  </option>
                ))}
              </select>
              <button
                className="button button-muted"
                type="button"
                disabled={draft.guests.length === 1}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    guests: current.guests.filter(
                      (_, guestIndex) => guestIndex !== index,
                    ),
                  }))
                }
                aria-label={`Remove guest ${index + 1}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {notice ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {notice}
        </p>
      ) : null}
      <div
        style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}
      >
        <button
          className="button button-muted"
          type="button"
          onClick={save}
          disabled={saving}
        >
          <Save size={15} />
          {saving ? "Saving..." : "Save Group"}
        </button>
        {draft.code ? (
          <button
            className="button button-muted"
            type="button"
            onClick={remove}
            disabled={deleting}
          >
            <Trash2 size={15} />
            {deleting ? "Deleting..." : "Delete Group"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RsvpView({
  snapshot,
  onSnapshot,
}: {
  snapshot: AdminSnapshot;
  onSnapshot: (snapshot: AdminSnapshot) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useFilteredInvitations(snapshot.invitations, query);
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="admin-panel">
        <label className="form-field">
          <span>Filter RSVP</span>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <InvitationTable
        content={snapshot.content}
        invitations={filtered}
        messageLogs={snapshot.messageLogs}
        showMeals
        editableStatus
        onSnapshot={onSnapshot}
      />
    </div>
  );
}

function InvitationTable({
  content,
  invitations,
  messageLogs,
  showMeals = false,
  editableStatus = false,
  editableFlow = false,
  onEdit,
  onSnapshot,
}: {
  content: WeddingContent;
  invitations: InvitationGroup[];
  messageLogs: AdminMessageLog[];
  showMeals?: boolean;
  editableStatus?: boolean;
  editableFlow?: boolean;
  onEdit?: (invitation: InvitationGroup) => void;
  onSnapshot?: (snapshot: AdminSnapshot) => void;
}) {
  const [updatingCode, setUpdatingCode] = useState("");
  const [notice, setNotice] = useState("");

  async function updateStatus(code: string, status: RsvpStatus) {
    setNotice("");
    setUpdatingCode(code);
    const response = await fetch("/api/admin/rsvp", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, status }),
    });
    const json = (await response.json()) as {
      snapshot?: AdminSnapshot;
      error?: string;
    };
    setUpdatingCode("");
    if (!response.ok || !json.snapshot) {
      setNotice(json.error || "Unable to update RSVP.");
      return;
    }
    onSnapshot?.(json.snapshot);
    setNotice("RSVP status updated.");
  }

  async function updateFlow(
    invitation: InvitationGroup,
    flow: PublicInviteFlow,
  ) {
    setNotice("");
    setUpdatingCode(invitation.code);
    const response = await fetch("/api/admin/guests", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...invitationToDraft(invitation),
        flow,
      }),
    });
    const json = (await response.json()) as {
      snapshot?: AdminSnapshot;
      error?: string;
    };
    setUpdatingCode("");
    if (!response.ok || !json.snapshot) {
      setNotice(json.error || "Unable to update invitation flow.");
      return;
    }
    onSnapshot?.(json.snapshot);
    setNotice("Invitation flow updated.");
  }

  return (
    <div className="admin-panel" style={{ overflowX: "auto" }}>
      {notice ? (
        <p className="muted" style={{ marginBottom: 10 }}>
          {notice}
        </p>
      ) : null}
      <table className="data-table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Guests</th>
            <th>Max</th>
            <th>Flow</th>
            <th>Status</th>
            <th>Events</th>
            <th>Code</th>
            <th>WhatsApp</th>
            {onEdit ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => (
            <tr key={invitation.id}>
              <td>
                <strong>{invitation.groupName}</strong>
                <p className="muted">{invitation.greeting}</p>
              </td>
              <td>
                {invitation.guests.map((guest) => (
                  <p key={guest.id}>
                    {guest.name}
                    {showMeals ? (
                      <span className="muted">
                        {" "}
                        · {guest.mealPreference.replace("_", " ")}
                      </span>
                    ) : null}
                  </p>
                ))}
              </td>
              <td>{invitation.maxGuests}</td>
              <td>
                {editableFlow ? (
                  <select
                    className="select"
                    value={invitation.flow}
                    disabled={updatingCode === invitation.code}
                    onChange={(event) =>
                      updateFlow(
                        invitation,
                        event.target.value as PublicInviteFlow,
                      )
                    }
                    aria-label={`Invitation flow for ${invitation.groupName}`}
                    style={{ minWidth: 130 }}
                  >
                    <option value="generic">General</option>
                    <option value="overseas">Overseas</option>
                    <option value="family">Family</option>
                  </select>
                ) : (
                  publicInviteFlowLabels[invitation.flow]
                )}
              </td>
              <td>
                {editableStatus ? (
                  <select
                    className="select"
                    value={invitation.rsvp.status}
                    disabled={updatingCode === invitation.code}
                    onChange={(event) =>
                      updateStatus(
                        invitation.code,
                        event.target.value as RsvpStatus,
                      )
                    }
                    aria-label={`RSVP status for ${invitation.groupName}`}
                    style={{ minWidth: 150 }}
                  >
                    <option value="pending">Pending</option>
                    <option value="attending">Attending</option>
                    <option value="declined">Declined</option>
                  </select>
                ) : (
                  <StatusPill status={invitation.rsvp.status} />
                )}
                {invitation.source === "generic" ? (
                  <p className="muted" style={{ marginTop: 6 }}>
                    Self-registered
                  </p>
                ) : null}
              </td>
              <td>{attendanceEventLabels(invitation)}</td>
              <td>
                <span style={{ display: "block" }}>{invitation.code}</span>
                <CopyInviteLinkButton code={invitation.code} />
              </td>
              <td>
                <WhatsAppMessageActions
                  content={content}
                  invitation={invitation}
                  messageLogs={messageLogs}
                  onSnapshot={onSnapshot}
                />
              </td>
              {onEdit ? (
                <td>
                  <button
                    className="button button-muted"
                    type="button"
                    onClick={() => onEdit(invitation)}
                  >
                    <Edit3 size={15} />
                    Edit
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Copies the guest's personal invite link (/invite/CODE) to the clipboard so
// the admin can paste it straight into a chat. Falls back to a prompt if the
// clipboard API is unavailable (e.g. non-secure context).
function CopyInviteLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/invite/${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this invite link", url);
    }
  }

  return (
    <button
      className="button button-muted"
      type="button"
      onClick={copyLink}
      style={{ marginTop: 6, padding: "3px 10px", fontSize: "0.8em" }}
      aria-label={`Copy invite link for code ${code}`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

function WhatsAppMessageActions({
  content,
  invitation,
  messageLogs,
  onSnapshot,
}: {
  content: WeddingContent;
  invitation: InvitationGroup;
  messageLogs: AdminMessageLog[];
  onSnapshot?: (snapshot: AdminSnapshot) => void;
}) {
  const [messageType, setMessageType] =
    useState<AdminWhatsAppMessageType>("invitation");
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState("");
  const baseUrl = "https://rsvp.edwardjessica.com";
  const isTravelMessage = messageType === "travel_plans";
  const travelMessageAllowed =
    invitation.flow === "overseas" || invitation.flow === "family";
  const message = buildAdminWhatsAppMessage({
    invitation,
    content,
    messageType,
    baseUrl,
  });
  const lastSent = messageLogs.find(
    (log) =>
      log.invitationGroupId === invitation.id &&
      log.channel === "whatsapp" &&
      log.messageType === messageType,
  );

  async function markSent() {
    setNotice("");
    setUpdating(true);
    const response = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        invitationGroupId: invitation.id,
        messageType,
        recipient: invitation.phone,
        messagePreview: message.slice(0, 500),
      }),
    });
    const json = (await response.json()) as {
      snapshot?: AdminSnapshot;
      error?: string;
    };
    setUpdating(false);
    if (!response.ok || !json.snapshot) {
      setNotice(json.error || "Unable to mark message as sent.");
      return;
    }
    onSnapshot?.(json.snapshot);
    setNotice("Marked sent.");
  }

  return (
    <div className="whatsapp-actions">
      <select
        className="select"
        value={messageType}
        onChange={(event) =>
          setMessageType(event.target.value as AdminWhatsAppMessageType)
        }
        aria-label={`WhatsApp message type for ${invitation.groupName}`}
      >
        <option value="invitation">{whatsappMessageLabels.invitation}</option>
        <option value="rsvp_confirmation">
          {whatsappMessageLabels.rsvp_confirmation}
        </option>
        <option value="travel_plans">
          {whatsappMessageLabels.travel_plans}
        </option>
      </select>
      <div className="whatsapp-action-row">
        <a
          className="button button-muted"
          href={buildWhatsAppMessageUrl(invitation.phone, message)}
          target="_blank"
          rel="noreferrer"
          aria-disabled={isTravelMessage && !travelMessageAllowed}
          onClick={(event) => {
            if (isTravelMessage && !travelMessageAllowed) event.preventDefault();
          }}
        >
          <Send size={15} />
          Open draft
        </a>
        <button
          className="button button-muted"
          disabled={updating || (isTravelMessage && !travelMessageAllowed)}
          type="button"
          onClick={markSent}
        >
          <CheckCircle2 size={15} />
          Mark sent
        </button>
      </div>
      {isTravelMessage && !travelMessageAllowed ? (
        <p className="muted">Travel message only applies to overseas/family.</p>
      ) : null}
      {lastSent ? (
        <p className="muted">Last sent: {formatDateTime(lastSent.sentAt)}</p>
      ) : null}
      {notice ? <p className="muted">{notice}</p> : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill ${status}`}>{status}</span>;
}

function ContentView({
  content,
  onContent,
}: {
  content: WeddingContent;
  onContent: (content: WeddingContent) => void;
}) {
  const [draft, setDraft] = useState(content);
  const [notice, setNotice] = useState("");
  const [uploadingDiscoverItemId, setUploadingDiscoverItemId] = useState("");

  async function persistDraftContent(
    nextDraft: WeddingContent,
    successNotice?: string,
  ) {
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextDraft),
    });
    const json = (await response.json()) as {
      content?: WeddingContent;
      error?: string;
    };
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to save draft.");
      return null;
    }
    onContent(json.content);
    setDraft(json.content);
    if (successNotice) setNotice(successNotice);
    return json.content;
  }

  async function save() {
    setNotice("");
    await persistDraftContent(draft, "Draft saved.");
  }

  async function publish() {
    setNotice("");
    const response = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    });
    const json = (await response.json()) as {
      content?: WeddingContent;
      error?: string;
    };
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to publish.");
      return;
    }
    onContent(json.content);
    setDraft(json.content);
    setNotice("Published.");
  }

  async function uploadDiscoverItemImage(
    event: ChangeEvent<HTMLInputElement>,
    itemId: string,
  ) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setNotice("");
    setUploadingDiscoverItemId(itemId);
    const savedDraft = await persistDraftContent(draft);
    if (!savedDraft) {
      setUploadingDiscoverItemId("");
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.set("kind", "gallery");
    formData.set("discoverItemId", itemId);
    formData.set("file", files[0]);

    const response = await fetch("/api/admin/media", {
      method: "POST",
      body: formData,
    });
    const json = (await response.json()) as {
      content?: WeddingContent;
      error?: string;
    };

    setUploadingDiscoverItemId("");
    event.target.value = "";
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to upload Discover item image.");
      return;
    }
    onContent(json.content);
    setDraft(json.content);
    setNotice("Discover item image uploaded to draft. Publish before sharing.");
  }

  function updatePublicInviteType(
    index: number,
    update: Partial<PublicInviteType>,
  ) {
    setDraft((current) => ({
      ...current,
      publicInviteTypes: current.publicInviteTypes.map(
        (inviteType, inviteTypeIndex) =>
          inviteTypeIndex === index ? { ...inviteType, ...update } : inviteType,
      ),
    }));
  }

  function updatePublicInviteTypeLabel(
    index: number,
    language: "en" | "id",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      publicInviteTypes: current.publicInviteTypes.map(
        (inviteType, inviteTypeIndex) =>
          inviteTypeIndex === index
            ? {
                ...inviteType,
                label: {
                  ...inviteType.label,
                  [language]: value,
                },
              }
            : inviteType,
      ),
    }));
  }

  function updatePublicInviteTypeDescription(
    index: number,
    language: "en" | "id",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      publicInviteTypes: current.publicInviteTypes.map(
        (inviteType, inviteTypeIndex) =>
          inviteTypeIndex === index
            ? {
                ...inviteType,
                description: {
                  en: inviteType.description?.en || "",
                  id: inviteType.description?.id || "",
                  [language]: value,
                },
              }
            : inviteType,
      ),
    }));
  }

  function addPublicInviteType() {
    const createdAt = Date.now();
    setDraft((current) => ({
      ...current,
      publicInviteTypes: [
        ...current.publicInviteTypes,
        {
          id: `custom-${createdAt}`,
          label: {
            en: "Custom Guests",
            id: "Tamu Khusus",
          },
          code: `EJ${String(current.publicInviteTypes.length + 1).padStart(2, "0")}`,
          flow: "generic",
          maxGuests: 2,
          requireGuestNames: false,
          isEnabled: true,
          description: {
            en: "Custom RSVP link.",
            id: "Tautan RSVP khusus.",
          },
        },
      ],
    }));
  }

  function removePublicInviteType(id: string) {
    setDraft((current) => ({
      ...current,
      publicInviteTypes:
        current.publicInviteTypes.length <= 1
          ? current.publicInviteTypes
          : current.publicInviteTypes.filter(
              (inviteType) => inviteType.id !== id,
            ),
    }));
  }

  return (
    <div className="admin-panel">
      <div className="grid-2">
        <label className="form-field">
          <span>Opening text EN</span>
          <textarea
            className="textarea"
            value={draft.openingText.en}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                openingText: { ...current.openingText, en: event.target.value },
              }))
            }
          />
        </label>
        <label className="form-field">
          <span>Opening text ID</span>
          <textarea
            className="textarea"
            value={draft.openingText.id}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                openingText: { ...current.openingText, id: event.target.value },
              }))
            }
          />
        </label>
        <label className="form-field">
          <span>RSVP deadline (Asia/Jakarta)</span>
          <input
            className="input"
            type="datetime-local"
            value={isoToJakartaLocal(draft.rsvpDeadline)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                // Treat the datetime-local value as Jakarta wall time (+07:00) so
                // repeated open/save cycles are byte-stable with no UTC drift.
                rsvpDeadline: jakartaLocalToIso(event.target.value),
              }))
            }
          />
        </label>
        <label className="form-field">
          <span>Parking note EN</span>
          <input
            className="input"
            value={draft.venue.parking.en}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                venue: {
                  ...current.venue,
                  parking: { ...current.venue.parking, en: event.target.value },
                },
              }))
            }
          />
        </label>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <div>
            <p className="eyebrow">Public RSVP Links</p>
            <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>
              Share link types
            </h3>
          </div>
          <button
            className="button button-muted"
            type="button"
            onClick={addPublicInviteType}
          >
            <Plus size={15} />
            Add Type
          </button>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {draft.publicInviteTypes.map((inviteType, index) => (
            <div className="invite-panel" key={inviteType.id}>
              <div className="section-heading" style={{ marginBottom: 14 }}>
                <div>
                  <p className="eyebrow">
                    {publicInviteFlowLabels[inviteType.flow]}
                  </p>
                  <h4
                    className="serif"
                    style={{ fontSize: "1.55rem", marginTop: 6 }}
                  >
                    {inviteType.label.en}
                  </h4>
                </div>
                <button
                  className="button button-muted"
                  type="button"
                  onClick={() => removePublicInviteType(inviteType.id)}
                  disabled={draft.publicInviteTypes.length <= 1}
                >
                  <Trash2 size={15} />
                  Remove
                </button>
              </div>
              <div className="grid-2">
                <label className="form-field">
                  <span>Label EN</span>
                  <input
                    className="input"
                    value={inviteType.label.en}
                    onChange={(event) =>
                      updatePublicInviteTypeLabel(
                        index,
                        "en",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Label ID</span>
                  <input
                    className="input"
                    value={inviteType.label.id}
                    onChange={(event) =>
                      updatePublicInviteTypeLabel(
                        index,
                        "id",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Invite code</span>
                  <input
                    className="input"
                    value={inviteType.code}
                    onChange={(event) =>
                      updatePublicInviteType(index, {
                        code: event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9-]/g, ""),
                      })
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Flow</span>
                  <select
                    className="select"
                    value={inviteType.flow}
                    onChange={(event) =>
                      updatePublicInviteType(index, {
                        flow: event.target.value as PublicInviteFlow,
                        maxGuests:
                          event.target.value === "overseas"
                            ? 1
                            : inviteType.maxGuests,
                      })
                    }
                  >
                    <option value="generic">General</option>
                    <option value="overseas">Overseas</option>
                    <option value="family">Family</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Max guests</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={inviteType.flow === "overseas" ? 1 : 10}
                    value={
                      inviteType.flow === "overseas" ? 1 : inviteType.maxGuests
                    }
                    disabled={inviteType.flow === "overseas"}
                    onChange={(event) =>
                      updatePublicInviteType(index, {
                        maxGuests: Math.min(
                          10,
                          Math.max(1, Number(event.target.value) || 1),
                        ),
                      })
                    }
                  />
                </label>
                <div className="form-field">
                  <span>Rules</span>
                  <label className="choice-row">
                    <span>Require every guest name</span>
                    <input
                      type="checkbox"
                      checked={inviteType.requireGuestNames}
                      onChange={(event) =>
                        updatePublicInviteType(index, {
                          requireGuestNames: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label className="choice-row">
                    <span>Enabled</span>
                    <input
                      type="checkbox"
                      checked={inviteType.isEnabled}
                      onChange={(event) =>
                        updatePublicInviteType(index, {
                          isEnabled: event.target.checked,
                        })
                      }
                    />
                  </label>
                </div>
                <label className="form-field">
                  <span>Description EN</span>
                  <textarea
                    className="textarea"
                    value={inviteType.description?.en || ""}
                    onChange={(event) =>
                      updatePublicInviteTypeDescription(
                        index,
                        "en",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Description ID</span>
                  <textarea
                    className="textarea"
                    value={inviteType.description?.id || ""}
                    onChange={(event) =>
                      updatePublicInviteTypeDescription(
                        index,
                        "id",
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>
              <p className="muted" style={{ marginTop: 12 }}>
                Share as /invite/{inviteType.code}. The /family and /overseas
                pages are preview aliases for their default flows.
              </p>
              <InviteTypeFlowPreview inviteType={inviteType} />
            </div>
          ))}
        </div>
      </div>

      <EventsEditor
        draft={draft}
        onDraft={setDraft}
      />

      <BrideGroomEditor
        draft={draft}
        onDraft={setDraft}
      />

      <OpeningAnimationEditor
        draft={draft}
        onDraft={setDraft}
      />

      <DiscoverMedanEditor
        content={draft}
        onChange={setDraft}
        onUploadItemImage={uploadDiscoverItemImage}
        uploadingItemId={uploadingDiscoverItemId}
      />

      <div
        style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}
      >
        <button className="button button-muted" type="button" onClick={save}>
          Save Draft
        </button>
        <button className="button button-muted" type="button" onClick={publish}>
          Publish
        </button>
      </div>
      {notice ? (
        <p className="muted" style={{ marginTop: 10 }}>
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function MediaView({
  content,
  onContent,
}: {
  content: WeddingContent;
  onContent: (content: WeddingContent) => void;
}) {
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState("");
  const [publishing, setPublishing] = useState(false);

  async function upload(
    event: ChangeEvent<HTMLInputElement>,
    kind: MediaAsset["kind"],
    options: { slot?: ImageSlot; target?: "desktop" | "mobile" } = {},
  ) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setNotice("");
    const uploadKey = options.target === "mobile" ? `${options.slot}-mobile` : (options.slot || kind);
    setUploading(uploadKey);
    let latestContent: WeddingContent | null = null;
    try {
      for (const file of options.slot ? files.slice(0, 1) : files) {
        const preparedFile = await prepareMediaFileForUpload(
          file,
          kind,
          options.slot,
        );
        const formData = new FormData();
        formData.set("file", preparedFile);
        formData.set("kind", kind);
        if (options.slot) formData.set("slot", options.slot);
        if (options.target) formData.set("target", options.target);
        const response = await fetchWithTimeout("/api/admin/media", {
          method: "POST",
          body: formData,
        });
        const json = (await response.json().catch(() => ({}))) as {
          content?: WeddingContent;
          error?: string;
        };
        if (!response.ok || !json.content) {
          setNotice(json.error || "Unable to upload media.");
          return;
        }
        latestContent = json.content;
      }

      if (latestContent) {
        onContent(latestContent);
        const slotLabel = options.slot ? imageSlotLabels[options.slot] : "";
        const targetLabel = options.target === "mobile" ? " (mobile)" : options.target === "desktop" ? " (desktop)" : "";
        setNotice(
          options.slot
            ? `${slotLabel}${targetLabel} photo uploaded to draft. Publish changes before sharing.`
            : "Media uploaded to draft. Publish changes before sharing.",
        );
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to upload media.",
      );
    } finally {
      setUploading("");
      event.target.value = "";
    }
  }

  async function remove(kind: MediaAsset["kind"], url: string) {
    setNotice("");
    const response = await fetch("/api/admin/media", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, url }),
    });
    const json = (await response.json()) as {
      content?: WeddingContent;
      error?: string;
    };
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to remove media.");
      return;
    }
    onContent(json.content);
    setNotice("Media removed from draft.");
  }

  async function removeMobileSlot(slot: ImageCropSlot) {
    setNotice("");
    const response = await fetch("/api/admin/media", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "removeMobileSlot", slot }),
    });
    const json = (await response.json()) as {
      content?: WeddingContent;
      error?: string;
    };
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to remove mobile image.");
      return;
    }
    onContent(json.content);
    setNotice(`${imageSlotLabels[slot]} mobile image removed.`);
  }

  async function saveCrop(slot: ImageCropSlot, crop: ImageCropSettings) {
    setNotice("");
    const response = await fetch("/api/admin/media", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "setImageCrop",
        slot,
        crop: normalizeImageCrop(crop),
      }),
    });
    const json = (await response.json()) as {
      content?: WeddingContent;
      error?: string;
    };
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to save crop settings.");
      return;
    }
    onContent(json.content);
    setNotice(`${imageSlotLabels[slot]} crop saved to draft.`);
  }

  async function saveFrame(slot: ImageCropSlot, ratio: ImageFrameRatio) {
    setNotice("");
    const response = await fetch("/api/admin/media", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "setImageFrame", slot, ratio }),
    });
    const json = (await response.json()) as {
      content?: WeddingContent;
      error?: string;
    };
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to save frame ratio.");
      return;
    }
    onContent(json.content);
    setNotice(`${imageSlotLabels[slot]} frame ratio saved to draft.`);
  }

  async function publish() {
    setNotice("");
    setPublishing(true);
    const response = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    });
    const json = (await response.json()) as {
      content?: WeddingContent;
      error?: string;
    };
    setPublishing(false);
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to publish media.");
      return;
    }
    onContent(json.content);
    setNotice("Published. Guests will now see the latest photos and music.");
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="admin-panel">
        <p className="eyebrow">Photos & Music</p>
        <h3 className="serif" style={{ fontSize: "2rem", marginTop: 6 }}>
          Draft media
        </h3>
        <p className="muted" style={{ marginTop: 8 }}>
          Photo uploads are optimized for web speed, saved to Supabase Storage,
          and added to the draft site. Publishing makes the current draft
          photos, music, and content visible to guests.
        </p>
        <div
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}
        >
          <button
            className="button button-muted"
            type="button"
            onClick={publish}
            disabled={publishing}
          >
            <Send size={17} />
            {publishing ? "Publishing..." : "Publish Draft Changes"}
          </button>
        </div>
        {notice ? (
          <p className="muted" style={{ marginTop: 10 }}>
            {notice}
          </p>
        ) : null}
      </div>

      <div className="admin-panel">
        <p className="eyebrow">Site Photo Slots</p>
        <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>
          Photos guests see
        </h3>
        <div className="media-list" style={{ marginTop: 12 }}>
          <SitePhotoSlot
            content={content}
            description="Full-screen opening image."
            label={imageSlotLabels.hero}
            onCropChange={(crop) => saveCrop("hero", crop)}
            onUploadDesktop={(event) => upload(event, "hero", { slot: "hero", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "hero", { slot: "hero", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("hero")}
            slot="hero"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Image shown below the opening invitation message."
            label={imageSlotLabels.invitation}
            onCropChange={(crop) => saveCrop("invitation", crop)}
            onFrameChange={(ratio) => saveFrame("invitation", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "invitation", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "invitation", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("invitation")}
            slot="invitation"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Image shown above the story section."
            label={imageSlotLabels.story}
            onCropChange={(crop) => saveCrop("story", crop)}
            onFrameChange={(ratio) => saveFrame("story", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "story", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "story", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("story")}
            slot="story"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Portrait photo of the bride in the Bride & Groom section."
            label={imageSlotLabels.bridePortrait}
            onCropChange={(crop) => saveCrop("bridePortrait", crop)}
            onFrameChange={(ratio) => saveFrame("bridePortrait", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "bridePortrait", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "bridePortrait", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("bridePortrait")}
            slot="bridePortrait"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Portrait photo of the groom in the Bride & Groom section."
            label={imageSlotLabels.groomPortrait}
            onCropChange={(crop) => saveCrop("groomPortrait", crop)}
            onFrameChange={(ratio) => saveFrame("groomPortrait", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "groomPortrait", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "groomPortrait", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("groomPortrait")}
            slot="groomPortrait"
            uploading={uploading}
          />
        </div>
      </div>

      <div className="admin-panel">
        <p className="eyebrow">Travel Page Photos</p>
        <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>
          Travel & Accommodation page
        </h3>
        <p className="muted" style={{ marginTop: 8 }}>
          These images affect the Travel & Accommodation page for overseas and
          family guests.
        </p>
        <div className="media-list" style={{ marginTop: 12 }}>
          <SitePhotoSlot
            content={content}
            description="Full-screen hero image for the Travel & Accommodation page."
            label={imageSlotLabels.travelHero}
            onCropChange={(crop) => saveCrop("travelHero", crop)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "travelHero", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "travelHero", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("travelHero")}
            slot="travelHero"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Image shown after the Kualanamu International Airport note."
            label={imageSlotLabels.travelAirport}
            onCropChange={(crop) => saveCrop("travelAirport", crop)}
            onFrameChange={(ratio) => saveFrame("travelAirport", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "travelAirport", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "travelAirport", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("travelAirport")}
            slot="travelAirport"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Image shown after the Grand City Hall Medan accommodation note."
            label={imageSlotLabels.travelAccommodation}
            onCropChange={(crop) => saveCrop("travelAccommodation", crop)}
            onFrameChange={(ratio) => saveFrame("travelAccommodation", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "travelAccommodation", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "travelAccommodation", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("travelAccommodation")}
            slot="travelAccommodation"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Image shown between Accommodation and the travel plans form."
            label={imageSlotLabels.travelForm}
            onCropChange={(crop) => saveCrop("travelForm", crop)}
            onFrameChange={(ratio) => saveFrame("travelForm", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "travelForm", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "travelForm", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("travelForm")}
            slot="travelForm"
            uploading={uploading}
          />
        </div>
      </div>

      <div className="admin-panel">
        <p className="eyebrow">Discover Medan Photos</p>
        <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>
          Food guide page
        </h3>
        <p className="muted" style={{ marginTop: 8 }}>
          These images affect the Discover Medan guide for overseas and family
          guests.
        </p>
        <div className="media-list" style={{ marginTop: 12 }}>
          <SitePhotoSlot
            content={content}
            description="Full-screen hero image for the Discover Medan page."
            label={imageSlotLabels.discoverHero}
            onCropChange={(crop) => saveCrop("discoverHero", crop)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "discoverHero", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "discoverHero", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("discoverHero")}
            slot="discoverHero"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Image shown beside the Discover Medan introduction."
            label={imageSlotLabels.discoverIntro}
            onCropChange={(crop) => saveCrop("discoverIntro", crop)}
            onFrameChange={(ratio) => saveFrame("discoverIntro", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "discoverIntro", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "discoverIntro", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("discoverIntro")}
            slot="discoverIntro"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Image used in the Local Food section."
            label={imageSlotLabels.discoverFood}
            onCropChange={(crop) => saveCrop("discoverFood", crop)}
            onFrameChange={(ratio) => saveFrame("discoverFood", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "discoverFood", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "discoverFood", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("discoverFood")}
            slot="discoverFood"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Image used in the Snacks & Supper Spots section."
            label={imageSlotLabels.discoverSupper}
            onCropChange={(crop) => saveCrop("discoverSupper", crop)}
            onFrameChange={(ratio) => saveFrame("discoverSupper", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "discoverSupper", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "discoverSupper", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("discoverSupper")}
            slot="discoverSupper"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Image used in the Cafes section."
            label={imageSlotLabels.discoverCafe}
            onCropChange={(crop) => saveCrop("discoverCafe", crop)}
            onFrameChange={(ratio) => saveFrame("discoverCafe", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "discoverCafe", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "discoverCafe", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("discoverCafe")}
            slot="discoverCafe"
            uploading={uploading}
          />
          <SitePhotoSlot
            content={content}
            description="Image used in the Places to Visit section."
            label={imageSlotLabels.discoverPlaces}
            onCropChange={(crop) => saveCrop("discoverPlaces", crop)}
            onFrameChange={(ratio) => saveFrame("discoverPlaces", ratio)}
            onUploadDesktop={(event) => upload(event, "gallery", { slot: "discoverPlaces", target: "desktop" })}
            onUploadMobile={(event) => upload(event, "gallery", { slot: "discoverPlaces", target: "mobile" })}
            onRemoveMobile={() => removeMobileSlot("discoverPlaces")}
            slot="discoverPlaces"
            uploading={uploading}
          />
        </div>
      </div>

      {/* OG / Link preview image slot */}
      <div className="admin-panel">
        <p className="eyebrow">Link Preview</p>
        <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>
          {imageSlotLabels.ogImage}
        </h3>
        <p className="muted" style={{ marginTop: 8 }}>
          Shown when the invite link is shared on WhatsApp or social media.
          Ideal ratio roughly 1.91:1 (e.g. 1200 × 630 px).
        </p>
        <div className="media-list" style={{ marginTop: 12 }}>
          <div style={{ padding: 12, border: "1px solid var(--line, #e0d8cc)", borderRadius: 8, background: "var(--bg-panel, #fff)" }}>
            {content.images?.ogImage ? (
              <>
                <Image
                  src={content.images.ogImage}
                  alt=""
                  width={320}
                  height={168}
                  unoptimized
                  style={{ borderRadius: 6, objectFit: "cover" }}
                />
                <p className="muted" style={{ marginTop: 8 }}>{content.images.ogImage}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <label className="button button-muted">
                    <ImagePlus size={14} />
                    {uploading === "ogImage" ? "Uploading…" : "Replace OG Image"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => upload(event, "gallery", { slot: "ogImage", target: "desktop" as const })}
                      style={{ display: "none" }}
                      disabled={uploading === "ogImage"}
                    />
                  </label>
                  <button
                    className="button button-muted"
                    type="button"
                    onClick={() => {
                      fetch("/api/admin/media", {
                        method: "PUT",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ action: "removeOgImage" }),
                      })
                        .then((r) => r.json())
                        .then((j: { content?: WeddingContent; error?: string }) => {
                          if (j.content) { onContent(j.content); setNotice("OG image removed."); }
                          else setNotice(j.error || "Unable to remove.");
                        });
                    }}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <div>
                <p className="muted">No link preview image set. Hero image will be used instead.</p>
                <label className="button button-muted" style={{ marginTop: 10, display: "inline-flex" }}>
                  <ImagePlus size={14} />
                  {uploading === "ogImage" ? "Uploading…" : "Upload OG Image"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => upload(event, "gallery", { slot: "ogImage", target: "desktop" as const })}
                    style={{ display: "none" }}
                    disabled={uploading === "ogImage"}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <div>
            <p className="eyebrow">Invitation Gallery</p>
            <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>
              {content.gallery.length} photos
            </h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Photos shown in the invitation page&apos;s Our Moments section.
            </p>
          </div>
          <label className="button button-muted">
            <ImagePlus size={17} />
            {uploading === "gallery"
              ? "Uploading..."
              : "Upload Gallery Photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => upload(event, "gallery")}
              style={{ display: "none" }}
            />
          </label>
        </div>
        <div className="media-list">
          {content.gallery.map((asset) => (
            <div className="media-preview-row" key={asset.id}>
              <Image
                src={asset.url}
                alt={asset.alt.en}
                width={160}
                height={120}
                unoptimized
              />
              <div>
                <p>{asset.alt.en}</p>
                <p className="muted" style={{ marginTop: 6 }}>
                  {asset.url}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 12,
                  }}
                >
                  <button
                    className="button button-muted"
                    type="button"
                    onClick={() => remove("gallery", asset.url)}
                  >
                    <Trash2 size={15} />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-panel">
        <p className="eyebrow">Music</p>
        {content.musicUrl ? (
          <div style={{ marginTop: 12 }}>
            <audio controls src={content.musicUrl} style={{ width: "100%" }} />
            <p className="muted" style={{ marginTop: 8 }}>
              {content.musicUrl}
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 12,
              }}
            >
              <label className="button button-muted">
                <Music2 size={17} />
                {uploading === "music" ? "Uploading..." : "Replace Music"}
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => upload(event, "music")}
                  style={{ display: "none" }}
                />
              </label>
              <button
                className="button button-muted"
                type="button"
                onClick={() => remove("music", content.musicUrl || "")}
              >
                <Trash2 size={15} />
                Remove Music
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <p className="muted">
              <Music2 size={15} style={{ display: "inline", marginRight: 6 }} />
              No music uploaded yet. The site starts music only after the guest
              taps the opening button.
            </p>
            <label className="button button-muted" style={{ marginTop: 12 }}>
              <Music2 size={17} />
              {uploading === "music" ? "Uploading..." : "Upload Music"}
              <input
                type="file"
                accept="audio/*"
                onChange={(event) => upload(event, "music")}
                style={{ display: "none" }}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// ── F1: WYSIWYG drag-to-crop editor ──────────────────────────────────────────
// The user drags the image inside a fixed-size frame preview.
// Drag delta is converted to focal-point x/y % (inverted so image follows cursor).
// A zoom slider (1–3) sits below the preview.
// Storage format unchanged: { desktop: {x,y,zoom}, mobile: {x,y,zoom} }.
function WysiwygCropEditor({
  focal: focalProp,
  frameRatio,
  label,
  onCommit,
  url,
}: {
  focal: ImageFocalPoint;
  frameRatio: string; // e.g. "3 / 2"
  label: string;
  onCommit: (focal: ImageFocalPoint) => void;
  url: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  // The editor owns ONLY its viewport's focal point. It must never see (or
  // emit) the other viewport's values — a previous design passed the whole
  // {desktop, mobile} object through both pane editors, and whichever pane
  // committed last clobbered the other viewport with a mount-time stale copy.
  //
  // Local optimistic focal so the preview follows the cursor instantly.
  // We persist (onCommit → parent) only on release, not on every move,
  // otherwise dragging fires dozens of saves/sec and the preview lags behind.
  const [localFocal, setLocalFocal] = useState<ImageFocalPoint>(focalProp);
  // latestRef always holds the newest focal SYNCHRONOUSLY. The release handlers
  // (onPointerUp / commitZoom) read from it rather than the `localFocal` closure,
  // which can be stale on fast drags (the final pointermove may not have
  // re-rendered before pointerup fires) — that stale read meant releases were
  // persisting the pre-drag value, so crop changes never saved.
  const latestRef = useRef<ImageFocalPoint>(focalProp);

  // Adopt external focal changes (Reset button, fresh server state) unless a
  // drag is in progress. Our own commits round-trip back as an identical value,
  // so this never reverts an optimistic edit.
  useEffect(() => {
    if (dragging) return;
    const current = latestRef.current;
    if (
      focalProp.x !== current.x ||
      focalProp.y !== current.y ||
      focalProp.zoom !== current.zoom
    ) {
      latestRef.current = focalProp;
      setLocalFocal(focalProp);
    }
  }, [focalProp, dragging]);

  const focal = localFocal;

  // Update preview (async render) + ref (sync, authoritative) together.
  function applyLocal(next: ImageFocalPoint) {
    latestRef.current = next;
    setLocalFocal(next);
  }

  // Pointer events (works for mouse + touch)
  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const f = latestRef.current;
    dragStart.current = { px: e.clientX, py: e.clientY, x: f.x, y: f.y };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current || !frameRef.current) return;
    const frame = frameRef.current.getBoundingClientRect();
    const scale = latestRef.current.zoom;
    // delta in px → % of frame, inverted (dragging the image right reveals the left)
    const dxPct = ((e.clientX - dragStart.current.px) * 100) / (frame.width * scale);
    const dyPct = ((e.clientY - dragStart.current.py) * 100) / (frame.height * scale);
    const newX = Math.min(100, Math.max(0, Math.round(dragStart.current.x - dxPct)));
    const newY = Math.min(100, Math.max(0, Math.round(dragStart.current.y - dyPct)));
    // Update local preview only — no server write while dragging.
    applyLocal(
      normalizeImageFocal(
        { ...latestRef.current, x: newX, y: newY },
        latestRef.current,
      ),
    );
  }

  function onPointerUp() {
    if (dragStart.current) {
      dragStart.current = null;
      setDragging(false);
      onCommit(latestRef.current); // persist the latest, on release
    }
  }

  // Keyboard nudge — arrow keys for accessibility (single step, persist immediately)
  function onKeyDown(e: React.KeyboardEvent) {
    const base = latestRef.current;
    const updates: Partial<ImageFocalPoint> = {};
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowLeft") updates.x = Math.max(0, base.x - step);
    if (e.key === "ArrowRight") updates.x = Math.min(100, base.x + step);
    if (e.key === "ArrowUp") updates.y = Math.max(0, base.y - step);
    if (e.key === "ArrowDown") updates.y = Math.min(100, base.y + step);
    if (Object.keys(updates).length) {
      e.preventDefault();
      const next = normalizeImageFocal({ ...base, ...updates }, base);
      applyLocal(next);
      onCommit(next);
    }
  }

  // Zoom slider: live local preview while sliding, persist on release.
  function onZoomInput(value: number) {
    applyLocal(
      normalizeImageFocal(
        { ...latestRef.current, zoom: value },
        latestRef.current,
      ),
    );
  }
  function commitZoom() {
    onCommit(latestRef.current);
  }

  // Compute CSS for the image inside the frame
  const objectPosition = `${focal.x}% ${focal.y}%`;

  return (
    <div style={{ marginBottom: 4 }}>
      <p className="muted" style={{ marginBottom: 6 }}>
        {label} — drag to reposition
      </p>
      {/* Frame preview */}
      <div
        ref={frameRef}
        style={{
          position: "relative",
          aspectRatio: frameRatio,
          overflow: "hidden",
          background: "var(--color-muted, #e8e4dc)",
          cursor: dragging ? "grabbing" : "grab",
          borderRadius: 4,
          maxWidth: 320,
          outline: dragging ? "2px solid var(--color-accent, #8b7355)" : "none",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        tabIndex={0}
        role="img"
        aria-label={`Crop preview for ${label}. Use arrow keys to move focal point.`}
        onKeyDown={onKeyDown}
      >
        {url ? (
          <Image
            src={url}
            alt=""
            fill
            unoptimized
            draggable={false}
            style={{
              objectFit: "cover",
              objectPosition,
              transform: `scale(${focal.zoom})`,
              transformOrigin: objectPosition,
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-muted-text, #9e978a)" }}>No image</div>
        )}
      </div>
      {/* Zoom slider */}
      <label style={{ display: "block", marginTop: 8 }}>
        <span className="muted">Zoom {focal.zoom.toFixed(2)}×</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={focal.zoom}
          style={{ display: "block", width: "100%", marginTop: 4 }}
          onChange={(e) => onZoomInput(Number(e.target.value))}
          onPointerUp={commitZoom}
          onKeyUp={commitZoom}
          onBlur={commitZoom}
        />
      </label>
      <p className="muted" style={{ marginTop: 4, fontSize: "0.8em" }}>
        Focal: {focal.x}% × {focal.y}%
      </p>
    </div>
  );
}

// F1 + F2 + F4: Full site photo slot with WYSIWYG crop, dual upload, ratio picker.
function SitePhotoSlot({
  content,
  description,
  label,
  onCropChange,
  onFrameChange,
  onRemoveMobile,
  onUploadDesktop,
  onUploadMobile,
  slot,
  uploading,
}: {
  content: WeddingContent;
  description: string;
  label: string;
  onCropChange: (crop: ImageCropSettings) => void;
  onFrameChange?: (ratio: ImageFrameRatio) => void;
  onRemoveMobile?: () => void;
  onUploadDesktop: (event: ChangeEvent<HTMLInputElement>) => void;
  onUploadMobile?: (event: ChangeEvent<HTMLInputElement>) => void;
  slot: ImageCropSlot;
  uploading: string;
}) {
  const isHero = slot === "hero";
  const [draftCrop, setDraftCrop] = useState(() => normalizeImageCrop(content.imageCrops?.[slot]));

  // Resolve URLs
  const desktopUrl: string =
    (content.images?.[slot] as string | undefined) ||
    contentLegacyUrl(content, slot);
  const mobileUrl: string | undefined =
    (content.mobileImages?.[slot] as string | undefined) || undefined;

  // Frame ratio for non-hero slots
  const currentFrame: ImageFrameRatio =
    content.imageFrames?.[slot] ??
    (slot === "invitation" ? "landscape" : slot === "story" || slot === "discoverIntro" ? "portrait" : "landscape");

  // For hero: fixed frames per viewport; for others use the slot frame
  const desktopFrameRatio = isHero ? "16 / 9" : FRAME_RATIOS[currentFrame];
  const mobileFrameRatio = isHero ? "9 / 16" : FRAME_RATIOS[currentFrame];

  // Each pane commits only its own viewport; merge functionally so one pane
  // can never overwrite the other's edits with a stale snapshot.
  // The "Save crop" button persists the merged result to the API.
  function handleFocalChange(
    viewport: keyof ImageCropSettings,
    focal: ImageFocalPoint,
  ) {
    setDraftCrop((prev) => ({ ...prev, [viewport]: focal }));
  }

  return (
    <div style={{ border: "1px solid var(--line, #e0d8cc)", borderRadius: 8, padding: 14, background: "var(--bg-panel, #fff)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div>
          <p className="eyebrow">{label}</p>
          <p className="muted" style={{ marginTop: 4 }}>{description}</p>
        </div>
        {/* F4: Ratio picker for non-hero slots */}
        {!isHero && onFrameChange ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: "0.8em" }}>Frame:</span>
            {(["landscape", "portrait", "square"] as ImageFrameRatio[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                className={`button button-muted${currentFrame === ratio ? " active" : ""}`}
                style={{ padding: "3px 10px", fontSize: "0.8em" }}
                onClick={() => onFrameChange(ratio)}
              >
                {ratio === "landscape" ? "Landscape" : ratio === "portrait" ? "Portrait" : "Square"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* F2: Dual upload targets + WYSIWYG crop editors */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 12 }}>
        {/* Desktop */}
        <div style={{ background: "var(--color-surface, #f9f6f0)", borderRadius: 6, padding: 14, border: "1px solid var(--color-border, #e0d8cc)" }}>
          <p className="muted" style={{ marginBottom: 6 }}>
            <strong>Desktop</strong>
            {!mobileUrl ? <span> · used everywhere if no mobile image is set</span> : null}
          </p>
          <WysiwygCropEditor
            focal={draftCrop.desktop}
            frameRatio={desktopFrameRatio}
            label="Desktop"
            onCommit={(focal) => handleFocalChange("desktop", focal)}
            url={desktopUrl}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <label className="button button-muted">
              <ImagePlus size={14} />
              {uploading === slot ? "Uploading…" : "Upload Desktop"}
              <input
                type="file"
                accept="image/*"
                onChange={onUploadDesktop}
                style={{ display: "none" }}
                disabled={uploading === slot}
              />
            </label>
            <button
              className="button button-muted"
              type="button"
              onClick={() => onCropChange(draftCrop)}
            >
              <Save size={14} />
              Save crop
            </button>
            <button
              className="button button-muted"
              type="button"
              onClick={() => {
                setDraftCrop(defaultImageCrop);
                onCropChange(defaultImageCrop);
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Mobile (not for ogImage which is display-only) */}
        {onUploadMobile ? (
          <div style={{ background: "var(--color-surface, #f9f6f0)", borderRadius: 6, padding: 14, border: "1px solid var(--color-border, #e0d8cc)" }}>
            <p className="muted" style={{ marginBottom: 6 }}>
              <strong>Mobile</strong>
              {!mobileUrl ? <span> · not set; desktop image used</span> : null}
            </p>
            <WysiwygCropEditor
              focal={draftCrop.mobile}
              frameRatio={mobileFrameRatio}
              label="Mobile"
              onCommit={(focal) => handleFocalChange("mobile", focal)}
              url={mobileUrl || desktopUrl}
            />
            <p className="muted" style={{ marginTop: 6, fontSize: "0.8em" }}>
              If only one image is set, it is used everywhere.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <label className="button button-muted">
                <ImagePlus size={14} />
                {uploading === `${slot}-mobile` ? "Uploading…" : mobileUrl ? "Replace Mobile" : "Upload Mobile"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onUploadMobile}
                  style={{ display: "none" }}
                  disabled={uploading === `${slot}-mobile`}
                />
              </label>
              {mobileUrl && onRemoveMobile ? (
                <button
                  className="button button-muted"
                  type="button"
                  onClick={onRemoveMobile}
                >
                  <Trash2 size={14} />
                  Remove Mobile
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Resolve the current desktop image URL for a slot (images map first, then
 *  the legacy *ImageUrl field; "" when a slot has neither — e.g. discoverPlaces). */
function contentLegacyUrl(content: WeddingContent, slot: ImageCropSlot): string {
  const fromImages = content.images?.[slot];
  if (fromImages) return fromImages;
  switch (slot) {
    case "hero": return content.heroImageUrl;
    case "invitation": return content.invitationImageUrl;
    case "story": return content.storyImageUrl;
    case "travelHero": return content.travelHeroImageUrl;
    case "travelAirport": return content.travelAirportImageUrl;
    case "travelAccommodation": return content.travelAccommodationImageUrl;
    case "travelForm": return content.travelFormImageUrl;
    case "discoverHero": return content.discoverHeroImageUrl;
    case "discoverIntro": return content.discoverIntroImageUrl;
    case "discoverFood": return content.discoverFoodImageUrl;
    case "discoverSupper": return content.discoverSupperImageUrl;
    case "discoverCafe": return content.discoverCafeImageUrl;
    default: return "";
  }
}

// F6: Events map URL editor, embedded in ContentView.
function EventsEditor({
  draft,
  onDraft,
}: {
  draft: WeddingContent;
  onDraft: (content: WeddingContent) => void;
}) {
  function updateEvent(key: EventKey, patch: Partial<WeddingContent["events"][number]>) {
    onDraft({
      ...draft,
      events: draft.events.map((event) =>
        event.key === key ? { ...event, ...patch } : event,
      ),
    });
  }

  function updateEventNote(key: EventKey, lang: "en" | "id", value: string) {
    onDraft({
      ...draft,
      events: draft.events.map((event) => {
        if (event.key !== key) return event;
        const note = {
          en: event.note?.en ?? "",
          id: event.note?.id ?? "",
          [lang]: value,
        };
        const hasContent = note.en.trim() || note.id.trim();
        return { ...event, note: hasContent ? note : undefined };
      }),
    });
  }

  function validateMapUrl(value: string) {
    if (!value.trim()) return true;
    try {
      const url = new URL(value.trim());
      return url.protocol === "https:";
    } catch {
      return false;
    }
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div className="section-heading" style={{ marginBottom: 12 }}>
        <div>
          <p className="eyebrow">Events</p>
          <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>
            Schedule
          </h3>
          <p className="muted" style={{ marginTop: 6 }}>
            Edit each event&apos;s time, venue, note, and Location link. Publish to
            apply changes for guests.
          </p>
        </div>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {draft.events.map((event) => {
          const urlValue = event.mapUrl || "";
          const valid = validateMapUrl(urlValue);
          return (
            <div key={event.key} className="invite-panel">
              <p className="eyebrow">{eventLabels[event.key as EventKey]}</p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <label className="form-field">
                  <span>Start time</span>
                  <input
                    className="input"
                    type="time"
                    value={event.startTime}
                    onChange={(e) => updateEvent(event.key, { startTime: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Venue name</span>
                  <input
                    className="input"
                    type="text"
                    value={event.venueName}
                    onChange={(e) => updateEvent(event.key, { venueName: e.target.value })}
                  />
                </label>
                <label className="form-field">
                  <span>Note (English)</span>
                  <textarea
                    className="input"
                    rows={2}
                    value={event.note?.en || ""}
                    placeholder="e.g. Dress code: semi formal."
                    onChange={(e) => updateEventNote(event.key, "en", e.target.value)}
                  />
                </label>
                <label className="form-field">
                  <span>Note (Indonesian)</span>
                  <textarea
                    className="input"
                    rows={2}
                    value={event.note?.id || ""}
                    placeholder="cth. Aturan berpakaian: semi formal."
                    onChange={(e) => updateEventNote(event.key, "id", e.target.value)}
                  />
                </label>
              </div>
              <label className="form-field" style={{ marginTop: 12 }}>
                <span>
                  <MapPin size={13} style={{ display: "inline", marginRight: 4 }} />
                  Google Maps link
                </span>
                <input
                  className="input"
                  type="url"
                  value={urlValue}
                  placeholder="https://maps.app.goo.gl/…"
                  onChange={(e) =>
                    updateEvent(event.key, { mapUrl: e.target.value.trim() || undefined })
                  }
                  style={!valid ? { borderColor: "var(--color-error, #c00)" } : undefined}
                />
              </label>
              {!valid && (
                <p className="muted" style={{ marginTop: 4, color: "var(--color-error, #c00)" }}>
                  Must be an https URL when present.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Bride & Groom frame selector — picks the portrait frame shape applied on the
// invite page. Writes brideGroomFrame into the draft content (same onDraft path
// as EventsEditor) so it persists with Save Draft and goes live with Publish.
const brideGroomFrameOptions: { value: BrideGroomFrame; label: string }[] = [
  { value: "arch", label: "Arch" },
  { value: "oval", label: "Oval" },
  { value: "octagon", label: "Octagon" },
  { value: "petal", label: "Petal" },
];

function BrideGroomEditor({
  draft,
  onDraft,
}: {
  draft: WeddingContent;
  onDraft: (content: WeddingContent) => void;
}) {
  const selected = draft.brideGroomFrame;

  return (
    <div style={{ marginTop: 28 }}>
      <div className="section-heading" style={{ marginBottom: 12 }}>
        <div>
          <p className="eyebrow">Bride &amp; Groom</p>
          <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>
            Bride &amp; Groom frame
          </h3>
          <p className="muted" style={{ marginTop: 6 }}>
            Choose the frame shape for the bride and groom portraits. Publish to
            apply for guests.
          </p>
        </div>
      </div>
      <div className="bg-frame-picker">
        {brideGroomFrameOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`bg-frame-swatch${
              option.value === selected ? " is-selected" : ""
            }`}
            aria-pressed={option.value === selected}
            onClick={() => onDraft({ ...draft, brideGroomFrame: option.value })}
          >
            <span className={`bg-frame-swatch-shape bg-frame-${option.value}`} />
            <span className="bg-frame-swatch-label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Opening animation selector — picks how guests first open the invitation.
// Writes openingAnimation into the draft content (same whole-draft onDraft path
// as BrideGroomEditor) so it persists with Save Draft and goes live with Publish.
const openingAnimationOptions: { value: OpeningAnimation; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "moongate", label: "Moon gate" },
  { value: "envelope", label: "Envelope" },
];

function OpeningAnimationEditor({
  draft,
  onDraft,
}: {
  draft: WeddingContent;
  onDraft: (content: WeddingContent) => void;
}) {
  const selected = draft.openingAnimation;

  return (
    <div style={{ marginTop: 28 }}>
      <div className="section-heading" style={{ marginBottom: 12 }}>
        <div>
          <p className="eyebrow">Opening Animation</p>
          <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>
            Opening animation
          </h3>
          <p className="muted" style={{ marginTop: 6 }}>
            How guests first open the invitation. Publish to apply.
          </p>
        </div>
      </div>
      <div className="bg-frame-picker">
        {openingAnimationOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`bg-frame-swatch${
              option.value === selected ? " is-selected" : ""
            }`}
            aria-pressed={option.value === selected}
            onClick={() =>
              onDraft({ ...draft, openingAnimation: option.value })
            }
          >
            <span
              className={`bg-frame-swatch-shape opening-swatch opening-swatch-${option.value}`}
            >
              {option.value === "classic" ? (
                <>
                  <span className="opening-swatch-line" />
                  <span className="opening-swatch-line" />
                  <span className="opening-swatch-pill" />
                </>
              ) : null}
              {option.value === "envelope" ? (
                <span className="opening-swatch-env-flap" />
              ) : null}
            </span>
            <span className="bg-frame-swatch-label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// B2: Travel tab — table of all submitted travel plans.
function TravelView({ snapshot }: { snapshot: AdminSnapshot }) {
  const plans = snapshot.travelPlans;
  const invitations = snapshot.invitations;

  function invitationForPlan(plan: TravelPlan): InvitationGroup | undefined {
    return invitations.find((inv) => inv.id === plan.invitationGroupId);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="admin-panel">
        <p className="eyebrow">Travel Plans</p>
        <h3 className="serif" style={{ fontSize: "2rem", marginTop: 6 }}>
          Submitted travel plans
        </h3>
        <p className="muted" style={{ marginTop: 8 }}>
          Sorted by arrival date (Asia/Jakarta). {plans.length} plan{plans.length !== 1 ? "s" : ""} submitted.
        </p>
      </div>
      {plans.length === 0 ? (
        <div className="admin-panel">
          <p className="muted">No travel plans submitted yet.</p>
        </div>
      ) : (
        <div className="admin-panel" style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Code</th>
                <th>Flow</th>
                <th>Guests</th>
                <th>Arrival</th>
                <th>Departure</th>
                <th>Accommodation</th>
                <th>Roommates</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const inv = invitationForPlan(plan);
                return (
                  <tr key={plan.id}>
                    <td>
                      <strong>{inv?.groupName || "—"}</strong>
                      {inv?.greeting ? (
                        <p className="muted">{inv.greeting}</p>
                      ) : null}
                    </td>
                    <td>{inv?.code || "—"}</td>
                    <td>{inv ? publicInviteFlowLabels[inv.flow] : "—"}</td>
                    <td>{inv?.guests.length ?? "—"}</td>
                    <td>{formatDateTime(plan.arrivalAt)}</td>
                    <td>{formatDateTime(plan.departureAt)}</td>
                    <td>{accommodationOptionLabels[plan.accommodationOption]}</td>
                    <td>{plan.preferredRoommates || "—"}</td>
                    <td>{formatDateTime(plan.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnalyticsView({ snapshot }: { snapshot: AdminSnapshot }) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <MetricGrid snapshot={snapshot} />
      <div className="admin-panel">
        <p className="eyebrow">History</p>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Changed</th>
                <th>Status</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.history.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.changedAt)}</td>
                  <td>
                    <StatusPill status={item.status} />
                  </td>
                  <td>{item.changedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExportView() {
  return (
    <div className="admin-panel">
      <p className="eyebrow">Backup</p>
      <h3 className="serif" style={{ fontSize: "2rem", marginTop: 6 }}>
        Export guest and RSVP data
      </h3>
      <div
        style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}
      >
        <a className="button button-muted" href="/api/admin/export?format=csv">
          <Download size={17} />
          CSV
        </a>
        <a className="button button-muted" href="/api/admin/export?format=json">
          <Download size={17} />
          JSON
        </a>
      </div>
    </div>
  );
}

function InviteTypeFlowPreview({
  inviteType,
}: {
  inviteType: PublicInviteType;
}) {
  if (inviteType.flow === "generic") return null;

  const isFamily = inviteType.flow === "family";

  return (
    <div className="flow-preview-panel">
      <div>
        <p className="eyebrow">
          {isFamily ? "Family flow pages" : "Overseas flow pages"}
        </p>
        <h5 className="serif">What this link will contain</h5>
      </div>
      <div className="flow-preview-grid">
        <div>
          <strong>1. Wedding RSVP</strong>
          <p className="muted">
            Current RSVP form for attendance, guest count, guest names, events,
            and meal preference.
          </p>
        </div>
        <div>
          <strong>2. Travel & Accommodation</strong>
          <p className="muted">
            Arrival and departure details with accommodation information
            {isFamily
              ? ", without roommate preference questions."
              : " and roommate preference questions."}
          </p>
        </div>
        <div>
          <strong>3. Medan Guide</strong>
          <p className="muted">
            Placeholder newsletter section for food, places, and things guests
            can enjoy around Medan.
          </p>
        </div>
      </div>
      <div className="flow-preview-actions">
        <a
          className="button button-muted"
          href={isFamily ? "/family" : "/overseas"}
          target="_blank"
          rel="noreferrer"
        >
          Preview {isFamily ? "/family" : "/overseas"}
        </a>
        <a
          className="button button-muted"
          href={`/invite/${inviteType.code}`}
          target="_blank"
          rel="noreferrer"
        >
          Preview /invite/{inviteType.code}
        </a>
      </div>
    </div>
  );
}

function useFilteredInvitations(invitations: InvitationGroup[], query: string) {
  return useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return invitations;
    return invitations.filter((invitation) => {
      const haystack = [
        invitation.groupName,
        invitation.greeting,
        invitation.code,
        invitation.side,
        invitation.rsvp.status,
        ...invitation.guests.map((guest) => guest.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [invitations, query]);
}

function emptyInvitationDraft(): AdminInvitationUpsert {
  return {
    groupName: "",
    greeting: "",
    phone: "",
    email: "",
    maxGuests: 1,
    side: "joint",
    flow: "generic",
    privateNotes: {
      en: "",
      id: "",
    },
    eligibleEvents: [...eventKeys],
    guests: [
      {
        name: "",
        mealPreference: "unset",
      },
    ],
  };
}

function invitationToDraft(invitation: InvitationGroup): AdminInvitationUpsert {
  return {
    code: invitation.code,
    groupName: invitation.groupName,
    greeting: invitation.greeting,
    phone: invitation.phone || "",
    email: invitation.email || "",
    maxGuests: invitation.maxGuests || invitation.guests.length || 1,
    side: invitation.side,
    flow: invitation.flow,
    privateNotes: {
      en: invitation.privateNotes?.en || "",
      id: invitation.privateNotes?.id || "",
    },
    eligibleEvents: invitation.eligibleEvents,
    guests: invitation.guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      mealPreference: guest.mealPreference,
    })),
    travelOverrides: invitation.travelOverrides,
  };
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

/**
 * Convert an ISO instant string to a datetime-local value rendered in
 * Asia/Jakarta wall time (UTC+7). The returned string is always in the
 * format required by <input type="datetime-local">: "YYYY-MM-DDTHH:mm".
 * This ensures the deadline editor always shows the correct Jakarta time
 * regardless of the admin's browser timezone.
 */
function isoToJakartaLocal(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso.slice(0, 16);
  // Extract wall-time parts in Asia/Jakarta
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") === "24" ? "00" : get("hour");
  const minute = get("minute");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Convert a datetime-local input value (treated as Asia/Jakarta wall time)
 * back to an ISO 8601 string with a +07:00 offset. This avoids the
 * browser-timezone ambiguity of `new Date(value)` and ensures that repeated
 * open/save cycles of the deadline editor are byte-stable.
 */
function jakartaLocalToIso(localValue: string): string {
  if (!localValue) return "";
  // localValue is "YYYY-MM-DDTHH:mm" — append the Jakarta offset directly.
  return `${localValue}:00+07:00`;
}
