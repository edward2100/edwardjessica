"use client";

import {
  BarChart3,
  Download,
  Edit3,
  FileText,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Music2,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
  Users,
  X
} from "lucide-react";
import { ChangeEvent, ElementType, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { buildWhatsAppUrl, eventKeys, mealPreferences } from "@/lib/rsvp";
import type {
  AdminGuestInput,
  AdminInvitationUpsert,
  AdminProfile,
  AdminSnapshot,
  EventKey,
  GuestSide,
  InvitationGroup,
  MediaAsset,
  RsvpStatus,
  WeddingContent
} from "@/lib/types";

type Tab = "dashboard" | "guests" | "rsvp" | "content" | "media" | "analytics" | "export";
type ImageSlot = "hero" | "invitation" | "story";

const tabs: { id: Tab; label: string; icon: ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "guests", label: "Guests", icon: Users },
  { id: "rsvp", label: "RSVP", icon: MessageCircle },
  { id: "content", label: "Content", icon: FileText },
  { id: "media", label: "Photos & Music", icon: ImagePlus },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "export", label: "Export", icon: Download }
];

const eventLabels: Record<EventKey, string> = {
  holy_matrimony: "Holy Matrimony",
  tea_lunch: "Tea & Lunch",
  dinner: "Dinner"
};

const imageSlotLabels: Record<ImageSlot, string> = {
  hero: "Hero",
  invitation: "Invitation Intro",
  story: "Our Story"
};

export function AdminDashboard({
  admin,
  snapshot
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
        <p className="muted" style={{ marginTop: 8 }}>{admin.displayName}</p>
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
        {activeTab === "dashboard" ? <DashboardView snapshot={currentSnapshot} /> : null}
        {activeTab === "guests" ? (
          <GuestsView snapshot={currentSnapshot} onSnapshot={setCurrentSnapshot} />
        ) : null}
        {activeTab === "rsvp" ? <RsvpView snapshot={currentSnapshot} onSnapshot={setCurrentSnapshot} /> : null}
        {activeTab === "content" ? (
          <ContentView content={currentSnapshot.content} onContent={(content) => setCurrentSnapshot((s) => ({ ...s, content }))} />
        ) : null}
        {activeTab === "media" ? (
          <MediaView
            content={currentSnapshot.content}
            onContent={(content) => setCurrentSnapshot((snapshot) => ({ ...snapshot, content }))}
          />
        ) : null}
        {activeTab === "analytics" ? <AnalyticsView snapshot={currentSnapshot} /> : null}
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
                  <td><StatusPill status={invitation.rsvp.status} /></td>
                  <td>{invitation.eligibleEvents.join(", ")}</td>
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
    ["Vegetarian", stats.vegetarianMeals]
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
  onSnapshot
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
      body: JSON.stringify({ csv })
    });
    const json = (await response.json()) as { snapshot?: AdminSnapshot; error?: string };
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
            <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} />
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
              placeholder="groupName,greeting,name,phone,email,side,events"
            />
          </label>
        </div>
        <button className="button button-muted" type="button" onClick={importCsv} disabled={!csv.trim()} style={{ marginTop: 14 }}>
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
        <button className="button button-muted" type="button" onClick={() => setEditing("new")} style={{ marginTop: 14, marginLeft: 10 }}>
          <Plus size={17} />
          New Group
        </button>
        {notice ? <p className="muted" style={{ marginTop: 10 }}>{notice}</p> : null}
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
      <InvitationTable invitations={filtered} onEdit={setEditing} />
    </div>
  );
}

function GuestGroupEditor({
  invitation,
  onCancel,
  onSaved,
  onDeleted
}: {
  invitation: InvitationGroup | null;
  onCancel: () => void;
  onSaved: (snapshot: AdminSnapshot, invitation: InvitationGroup) => void;
  onDeleted: (snapshot: AdminSnapshot) => void;
}) {
  const [draft, setDraft] = useState<AdminInvitationUpsert>(
    invitation ? invitationToDraft(invitation) : emptyInvitationDraft()
  );
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function setField<K extends keyof AdminInvitationUpsert>(key: K, value: AdminInvitationUpsert[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setGuest(index: number, update: Partial<AdminGuestInput>) {
    setDraft((current) => ({
      ...current,
      guests: current.guests.map((guest, guestIndex) =>
        guestIndex === index ? { ...guest, ...update } : guest
      )
    }));
  }

  async function save() {
    setNotice("");
    setSaving(true);
    const response = await fetch("/api/admin/guests", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft)
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
    const confirmed = window.confirm(`Delete ${draft.groupName}? This also removes their RSVP.`);
    if (!confirmed) return;

    setNotice("");
    setDeleting(true);
    const response = await fetch("/api/admin/guests", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: draft.code })
    });
    const json = (await response.json()) as { snapshot?: AdminSnapshot; error?: string };
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
          <p className="eyebrow">{draft.code ? `Edit ${draft.code}` : "New Guest Group"}</p>
          <h3 className="serif" style={{ fontSize: "2rem", marginTop: 6 }}>
            {draft.groupName || "Guest group"}
          </h3>
        </div>
        <button className="button button-muted" type="button" onClick={onCancel}>
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
            onChange={(event) => setField("side", event.target.value as GuestSide)}
          >
            <option value="joint">Joint</option>
            <option value="groom">Groom</option>
            <option value="bride">Bride</option>
          </select>
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
                      : draft.eligibleEvents.filter((item) => item !== eventKey)
                  )
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <label className="form-field">
          <span>Private note EN</span>
          <textarea
            className="textarea"
            value={draft.privateNotes?.en || ""}
            onChange={(event) =>
              setField("privateNotes", {
                ...draft.privateNotes,
                en: event.target.value
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
                id: event.target.value
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
              setField("guests", [...draft.guests, { name: "", mealPreference: "unset" }])
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
                onChange={(event) => setGuest(index, { name: event.target.value })}
              />
              <select
                className="select"
                aria-label={`Guest ${index + 1} meal preference`}
                value={guest.mealPreference}
                onChange={(event) =>
                  setGuest(index, { mealPreference: event.target.value as AdminGuestInput["mealPreference"] })
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
                  setField(
                    "guests",
                    draft.guests.filter((_, guestIndex) => guestIndex !== index)
                  )
                }
                aria-label={`Remove guest ${index + 1}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {notice ? <p className="muted" style={{ marginTop: 12 }}>{notice}</p> : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        <button className="button button-muted" type="button" onClick={save} disabled={saving}>
          <Save size={15} />
          {saving ? "Saving..." : "Save Group"}
        </button>
        {draft.code ? (
          <button className="button button-muted" type="button" onClick={remove} disabled={deleting}>
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
  onSnapshot
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
          <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      <InvitationTable invitations={filtered} showMeals editableStatus onSnapshot={onSnapshot} />
    </div>
  );
}

function InvitationTable({
  invitations,
  showMeals = false,
  editableStatus = false,
  onEdit,
  onSnapshot
}: {
  invitations: InvitationGroup[];
  showMeals?: boolean;
  editableStatus?: boolean;
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
      body: JSON.stringify({ code, status })
    });
    const json = (await response.json()) as { snapshot?: AdminSnapshot; error?: string };
    setUpdatingCode("");
    if (!response.ok || !json.snapshot) {
      setNotice(json.error || "Unable to update RSVP.");
      return;
    }
    onSnapshot?.(json.snapshot);
    setNotice("RSVP status updated.");
  }

  return (
    <div className="admin-panel" style={{ overflowX: "auto" }}>
      {notice ? <p className="muted" style={{ marginBottom: 10 }}>{notice}</p> : null}
      <table className="data-table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Guests</th>
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
                    {showMeals ? <span className="muted"> · {guest.mealPreference.replace("_", " ")}</span> : null}
                  </p>
                ))}
              </td>
              <td>
                {editableStatus ? (
                  <select
                    className="select"
                    value={invitation.rsvp.status}
                    disabled={updatingCode === invitation.code}
                    onChange={(event) => updateStatus(invitation.code, event.target.value as RsvpStatus)}
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
                  <p className="muted" style={{ marginTop: 6 }}>Self-registered</p>
                ) : null}
              </td>
              <td>{invitation.eligibleEvents.join(", ")}</td>
              <td>{invitation.code}</td>
              <td>
                <a
                  className="button button-muted"
                  href={buildWhatsAppUrl(invitation.phone, `/invite/${invitation.code}`, invitation.greeting)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Send size={15} />
                  Send
                </a>
              </td>
              {onEdit ? (
                <td>
                  <button className="button button-muted" type="button" onClick={() => onEdit(invitation)}>
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

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill ${status}`}>{status}</span>;
}

function ContentView({
  content,
  onContent
}: {
  content: WeddingContent;
  onContent: (content: WeddingContent) => void;
}) {
  const [draft, setDraft] = useState(content);
  const [notice, setNotice] = useState("");

  async function save() {
    setNotice("");
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft)
    });
    const json = (await response.json()) as { content?: WeddingContent; error?: string };
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to save draft.");
      return;
    }
    onContent(json.content);
    setNotice("Draft saved.");
  }

  async function publish() {
    setNotice("");
    const response = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "publish" })
    });
    const json = (await response.json()) as { content?: WeddingContent; error?: string };
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to publish.");
      return;
    }
    onContent(json.content);
    setDraft(json.content);
    setNotice("Published.");
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
                openingText: { ...current.openingText, en: event.target.value }
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
                openingText: { ...current.openingText, id: event.target.value }
              }))
            }
          />
        </label>
        <label className="form-field">
          <span>RSVP deadline</span>
          <input
            className="input"
            type="datetime-local"
            value={draft.rsvpDeadline.slice(0, 16)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                rsvpDeadline: new Date(event.target.value).toISOString()
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
                  parking: { ...current.venue.parking, en: event.target.value }
                }
              }))
            }
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        <button className="button button-muted" type="button" onClick={save}>
          Save Draft
        </button>
        <button className="button button-muted" type="button" onClick={publish}>
          Publish
        </button>
      </div>
      {notice ? <p className="muted" style={{ marginTop: 10 }}>{notice}</p> : null}
    </div>
  );
}

function MediaView({
  content,
  onContent
}: {
  content: WeddingContent;
  onContent: (content: WeddingContent) => void;
}) {
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState("");
  const [publishing, setPublishing] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>, kind: MediaAsset["kind"]) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setNotice("");
    setUploading(kind);
    let latestContent: WeddingContent | null = null;
    for (const file of files) {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", kind);
      const response = await fetch("/api/admin/media", { method: "POST", body: formData });
      const json = (await response.json()) as { content?: WeddingContent; error?: string };
      if (!response.ok || !json.content) {
        setUploading("");
        setNotice(json.error || "Unable to upload media.");
        event.target.value = "";
        return;
      }
      latestContent = json.content;
    }

    setUploading("");
    event.target.value = "";
    if (latestContent) {
      onContent(latestContent);
      setNotice("Media uploaded to draft. Publish changes before sharing.");
    }
  }

  async function setImageSlot(slot: ImageSlot, url: string) {
    setNotice("");
    const response = await fetch("/api/admin/media", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "setImageSlot", slot, url })
    });
    const json = (await response.json()) as { content?: WeddingContent; error?: string };
    if (!response.ok || !json.content) {
      setNotice(json.error || `Unable to set ${imageSlotLabels[slot].toLowerCase()} photo.`);
      return;
    }
    onContent(json.content);
    setNotice(`${imageSlotLabels[slot]} photo updated in draft. Publish changes before sharing.`);
  }

  async function remove(kind: MediaAsset["kind"], url: string) {
    setNotice("");
    const response = await fetch("/api/admin/media", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, url })
    });
    const json = (await response.json()) as { content?: WeddingContent; error?: string };
    if (!response.ok || !json.content) {
      setNotice(json.error || "Unable to remove media.");
      return;
    }
    onContent(json.content);
    setNotice("Media removed from draft.");
  }

  async function publish() {
    setNotice("");
    setPublishing(true);
    const response = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "publish" })
    });
    const json = (await response.json()) as { content?: WeddingContent; error?: string };
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
        <h3 className="serif" style={{ fontSize: "2rem", marginTop: 6 }}>Draft media</h3>
        <p className="muted" style={{ marginTop: 8 }}>
          Uploads are saved to Supabase Storage and added to the draft site. Publish changes before sharing.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <label className="button button-muted">
            <ImagePlus size={17} />
            {uploading === "hero" ? "Uploading..." : "Upload Hero"}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => upload(event, "hero")}
              style={{ display: "none" }}
            />
          </label>
          <label className="button button-muted">
            <ImagePlus size={17} />
            {uploading === "gallery" ? "Uploading..." : "Upload Gallery"}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => upload(event, "gallery")}
              style={{ display: "none" }}
            />
          </label>
          <label className="button button-muted">
            <Music2 size={17} />
            {uploading === "music" ? "Uploading..." : "Upload Music"}
            <input
              type="file"
              accept="audio/*"
              onChange={(event) => upload(event, "music")}
              style={{ display: "none" }}
            />
          </label>
          <button className="button button-muted" type="button" onClick={publish} disabled={publishing}>
            <Send size={17} />
            {publishing ? "Publishing..." : "Publish Media"}
          </button>
        </div>
        {notice ? <p className="muted" style={{ marginTop: 10 }}>{notice}</p> : null}
      </div>

      <div className="admin-panel">
        <p className="eyebrow">Site Photo Slots</p>
        <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>Photos guests see</h3>
        <div className="media-list" style={{ marginTop: 12 }}>
          <SitePhotoSlot
            description="Full-screen opening image."
            label={imageSlotLabels.hero}
            url={content.heroImageUrl}
          />
          <SitePhotoSlot
            description="Image shown below the opening invitation message."
            label={imageSlotLabels.invitation}
            url={content.invitationImageUrl}
          />
          <SitePhotoSlot
            description="Image shown above the story section."
            label={imageSlotLabels.story}
            url={content.storyImageUrl}
          />
        </div>
      </div>

      <div className="admin-panel">
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <div>
            <p className="eyebrow">Gallery</p>
            <h3 className="serif" style={{ fontSize: "1.8rem", marginTop: 6 }}>{content.gallery.length} photos</h3>
          </div>
        </div>
        <div className="media-list">
          {content.gallery.map((asset) => (
            <div className="media-preview-row" key={asset.id}>
              <Image src={asset.url} alt={asset.alt.en} width={160} height={120} />
              <div>
                <p>{asset.alt.en}</p>
                <p className="muted" style={{ marginTop: 6 }}>{asset.url}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button className="button button-muted" type="button" onClick={() => setImageSlot("hero", asset.url)}>
                    <ImagePlus size={15} />
                    Set Hero
                  </button>
                  <button className="button button-muted" type="button" onClick={() => setImageSlot("invitation", asset.url)}>
                    <ImagePlus size={15} />
                    Set Invitation
                  </button>
                  <button className="button button-muted" type="button" onClick={() => setImageSlot("story", asset.url)}>
                    <ImagePlus size={15} />
                    Set Story
                  </button>
                  <button className="button button-muted" type="button" onClick={() => remove("gallery", asset.url)}>
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
            <p className="muted" style={{ marginTop: 8 }}>{content.musicUrl}</p>
            <button className="button button-muted" type="button" onClick={() => remove("music", content.musicUrl || "")} style={{ marginTop: 12 }}>
              <Trash2 size={15} />
              Remove Music
            </button>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 8 }}>
            <Music2 size={15} style={{ display: "inline", marginRight: 6 }} />
            No music uploaded yet. The site starts music only after the guest taps the opening button.
          </p>
        )}
      </div>
    </div>
  );
}

function SitePhotoSlot({
  description,
  label,
  url
}: {
  description: string;
  label: string;
  url: string;
}) {
  return (
    <div className="media-preview-row">
      <Image src={url} alt="" width={160} height={120} />
      <div>
        <p className="eyebrow">{label}</p>
        <p style={{ marginTop: 6 }}>{url}</p>
        <p className="muted" style={{ marginTop: 8 }}>{description}</p>
      </div>
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
                  <td><StatusPill status={item.status} /></td>
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
      <h3 className="serif" style={{ fontSize: "2rem", marginTop: 6 }}>Export guest and RSVP data</h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
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
        ...invitation.guests.map((guest) => guest.name)
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
    side: "joint",
    privateNotes: {
      en: "",
      id: ""
    },
    eligibleEvents: [...eventKeys],
    guests: [
      {
        name: "",
        mealPreference: "unset"
      }
    ]
  };
}

function invitationToDraft(invitation: InvitationGroup): AdminInvitationUpsert {
  return {
    code: invitation.code,
    groupName: invitation.groupName,
    greeting: invitation.greeting,
    phone: invitation.phone || "",
    email: invitation.email || "",
    side: invitation.side,
    privateNotes: {
      en: invitation.privateNotes?.en || "",
      id: invitation.privateNotes?.id || ""
    },
    eligibleEvents: invitation.eligibleEvents,
    guests: invitation.guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      mealPreference: guest.mealPreference
    }))
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
    hour12: false
  }).format(new Date(value));
}
