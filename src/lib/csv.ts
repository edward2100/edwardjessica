import Papa from "papaparse";
import type {
  EventKey,
  GuestCsvRow,
  GuestSide,
  PublicInviteFlow,
} from "@/lib/types";
import { eventKeys } from "@/lib/rsvp";

const sides: GuestSide[] = ["groom", "bride", "joint"];
const flows: PublicInviteFlow[] = ["generic", "overseas", "family"];

function parseSide(value: unknown): GuestSide {
  const normalized = String(value || "joint")
    .trim()
    .toLowerCase();
  if (sides.includes(normalized as GuestSide)) return normalized as GuestSide;
  return "joint";
}

function parseFlow(value: unknown): PublicInviteFlow {
  const normalized = String(value || "generic")
    .trim()
    .toLowerCase();
  if (normalized === "general") return "generic";
  if (flows.includes(normalized as PublicInviteFlow))
    return normalized as PublicInviteFlow;
  return "generic";
}

function parseEvents(value: unknown): EventKey[] {
  const raw = String(value || "dinner")
    .split(/[|,;]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const parsed = raw.filter((item): item is EventKey =>
    eventKeys.includes(item as EventKey),
  );
  return parsed.length ? parsed : ["dinner"];
}

function parseMaxGuests(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(10, Math.max(1, Math.floor(parsed)))
    : undefined;
}

export function parseGuestCsv(csv: string): GuestCsvRow[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length) {
    throw new Error(result.errors.map((error) => error.message).join(", "));
  }

  return result.data
    .filter((row) => row.name || row.Name)
    .map((row) => ({
      groupName:
        row.groupName ||
        row.group ||
        row["Group Name"] ||
        row.name ||
        row.Name ||
        "Guest Group",
      greeting: row.greeting || row.Greeting || `Dear ${row.name || row.Name}`,
      name: row.name || row.Name || "Guest",
      phone: row.phone || row.Phone || undefined,
      email: row.email || row.Email || undefined,
      maxGuests: parseMaxGuests(row.maxGuests || row["Max Guests"]),
      side: parseSide(row.side || row.Side),
      flow: parseFlow(row.flow || row.Flow),
      events: parseEvents(row.events || row.Events),
      privateNotesEn:
        row.privateNotesEn || row["Private Notes EN"] || undefined,
      privateNotesId:
        row.privateNotesId || row["Private Notes ID"] || undefined,
    }));
}

export function serializeInvitationsCsv(
  rows: Array<Record<string, string | number | boolean | undefined>>,
) {
  return Papa.unparse(rows);
}

export function buildGuestCsvTemplate() {
  return serializeInvitationsCsv([
    {
      groupName: "Hardwin Family",
      greeting: "Dear Mr. Hardwin & Family",
      name: "Hardwin Salim",
      phone: "+628123456789",
      email: "hardwin.family@example.com",
      maxGuests: 6,
      side: "bride",
      flow: "family",
      events: "holy_matrimony|tea_lunch|dinner",
      privateNotesEn:
        "Accommodation note: a limited room block can be requested through the family.",
      privateNotesId:
        "Catatan akomodasi: kamar terbatas dapat diminta melalui keluarga.",
    },
    {
      groupName: "Hardwin Family",
      greeting: "Dear Mr. Hardwin & Family",
      name: "Masria Ang",
      phone: "+628123456789",
      email: "hardwin.family@example.com",
      maxGuests: 6,
      side: "bride",
      flow: "family",
      events: "holy_matrimony|tea_lunch|dinner",
      privateNotesEn:
        "Accommodation note: a limited room block can be requested through the family.",
      privateNotesId:
        "Catatan akomodasi: kamar terbatas dapat diminta melalui keluarga.",
    },
    {
      groupName: "University Friends",
      greeting: "Dear University Friends",
      name: "University Friend",
      phone: "",
      email: "",
      maxGuests: 1,
      side: "joint",
      flow: "generic",
      events: "dinner",
      privateNotesEn: "",
      privateNotesId: "",
    },
  ]);
}
