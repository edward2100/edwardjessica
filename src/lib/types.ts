export type Language = "en" | "id";

export type LocalizedString = Record<Language, string>;

export type EventKey = "holy_matrimony" | "tea_lunch" | "dinner";

export type MealPreference = "vegetarian" | "non_vegetarian" | "unset";

export type RsvpStatus = "pending" | "attending" | "declined";

export type GuestSide = "groom" | "bride" | "joint";

export type AdminRole = "super_admin";

export type InvitationSource = "admin" | "generic";

export interface WeddingEvent {
  key: EventKey;
  title: LocalizedString;
  shortTitle: LocalizedString;
  date: string;
  startTime: string;
  endTime?: string;
  venueName: string;
  venueAddress: string;
  note?: LocalizedString;
}

export interface WeddingContent {
  coupleName: string;
  groomName: string;
  brideName: string;
  weddingDate: string;
  timezone: string;
  rsvpDeadline: string;
  defaultLanguage: Language;
  openingText: LocalizedString;
  introText: LocalizedString;
  loveStory: LocalizedString;
  proposalStory: LocalizedString;
  coupleBio: LocalizedString;
  parents: {
    groom: string[];
    bride: string[];
  };
  venue: {
    name: string;
    address: string;
    mapsUrl: string;
    parking: LocalizedString;
  };
  notes: LocalizedString[];
  dressCode: LocalizedString;
  musicUrl?: string;
  heroImageUrl: string;
  invitationImageUrl: string;
  storyImageUrl: string;
  gallery: MediaAsset[];
  events: WeddingEvent[];
  publishedAt?: string;
}

export interface MediaAsset {
  id: string;
  kind: "hero" | "gallery" | "music";
  url: string;
  alt: LocalizedString;
  sortOrder: number;
  isPublished: boolean;
}

export interface InvitationGroup {
  id: string;
  code: string;
  greeting: string;
  groupName: string;
  phone?: string;
  email?: string;
  side: GuestSide;
  source?: InvitationSource;
  privateNotes?: LocalizedString;
  eligibleEvents: EventKey[];
  openedAt?: string;
  rsvp: Rsvp;
  guests: Guest[];
}

export interface Guest {
  id: string;
  invitationGroupId: string;
  name: string;
  mealPreference: MealPreference;
}

export interface Rsvp {
  id: string;
  invitationGroupId: string;
  status: RsvpStatus;
  eventAttendance: Partial<Record<EventKey, boolean>>;
  message?: string;
  submittedAt?: string;
  updatedAt?: string;
  updatedBy?: "guest" | "admin";
}

export interface RsvpSubmission {
  code: string;
  status: Exclude<RsvpStatus, "pending">;
  eventAttendance: Partial<Record<EventKey, boolean>>;
  mealPreferences: Record<string, MealPreference>;
  message?: string;
}

export interface SelfRegistrationSubmission {
  accessCode: string;
  name: string;
  phone: string;
  guestCount: number;
  mealPreference: Exclude<MealPreference, "unset">;
  status: Exclude<RsvpStatus, "pending">;
  eventAttendance: Partial<Record<EventKey, boolean>>;
  message?: string;
}

export interface AdminRsvpUpdate {
  code: string;
  status: RsvpStatus;
}

export interface AdminGuestInput {
  id?: string;
  name: string;
  mealPreference: MealPreference;
}

export interface AdminInvitationUpsert {
  code?: string;
  groupName: string;
  greeting: string;
  phone?: string;
  email?: string;
  side: GuestSide;
  privateNotes?: Partial<LocalizedString>;
  eligibleEvents: EventKey[];
  guests: AdminGuestInput[];
}

export interface RsvpHistoryItem {
  id: string;
  invitationGroupId: string;
  status: RsvpStatus;
  changedBy: "guest" | "admin";
  changedAt: string;
  snapshot: unknown;
}

export interface AdminProfile {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
}

export interface DashboardStats {
  totalInvitedPeople: number;
  totalInvitations: number;
  attendingInvitations: number;
  declinedInvitations: number;
  pendingInvitations: number;
  inviteOpens: number;
  rsvpCompletionRate: number;
  vegetarianMeals: number;
  nonVegetarianMeals: number;
}

export interface AdminSnapshot {
  stats: DashboardStats;
  invitations: InvitationGroup[];
  content: WeddingContent;
  history: RsvpHistoryItem[];
}

export interface GuestCsvRow {
  groupName: string;
  greeting: string;
  name: string;
  phone?: string;
  email?: string;
  side: GuestSide;
  events: EventKey[];
  privateNotesEn?: string;
  privateNotesId?: string;
}
