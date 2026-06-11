export type Language = "en" | "id";

export type LocalizedString = Record<Language, string>;

export type EventKey = "holy_matrimony" | "tea_lunch" | "dinner";

export type MealPreference = "vegetarian" | "non_vegetarian" | "unset";

export type RsvpStatus = "pending" | "attending" | "declined";

export type GuestSide = "groom" | "bride" | "joint";

export type AdminRole = "super_admin";

export type InvitationSource = "admin" | "generic";

export type PublicInviteFlow = "generic" | "family" | "overseas";

export type DiscoverMedanSectionId =
  | "localFood"
  | "supper"
  | "cafe"
  | "placesToVisit";

export type TravelAccommodationOption =
  | "specific_roommates"
  | "assign_roommates"
  | "own_accommodation";

export type AdminWhatsAppMessageType =
  | "invitation"
  | "rsvp_confirmation"
  | "travel_plans";

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
  mapUrl?: string;
}

export interface DiscoverMedanGuideItem {
  id: string;
  name: LocalizedString;
  note: LocalizedString;
  imageUrl?: string;
  mapUrl?: string;
}

export interface DiscoverMedanGuideSection {
  id: DiscoverMedanSectionId;
  eyebrow: LocalizedString;
  title: LocalizedString;
  intro: LocalizedString;
  items: DiscoverMedanGuideItem[];
}

export interface DiscoverMedanContent {
  heroKicker: LocalizedString;
  heroTitle: LocalizedString;
  heroSubtitle: LocalizedString;
  heroButton: LocalizedString;
  introEyebrow: LocalizedString;
  introTitle: LocalizedString;
  introParagraphs: Record<Language, string[]>;
  sections: DiscoverMedanGuideSection[];
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
  travelHeroImageUrl: string;
  travelAirportImageUrl: string;
  travelAccommodationImageUrl: string;
  travelFormImageUrl: string;
  discoverHeroImageUrl: string;
  discoverIntroImageUrl: string;
  discoverFoodImageUrl: string;
  discoverSupperImageUrl: string;
  discoverCafeImageUrl: string;
  imageCrops: Partial<Record<ImageCropSlot, ImageCropSettings>>;
  images: Partial<Record<ImageCropSlot | "ogImage", string>>;
  mobileImages: Partial<Record<ImageCropSlot, string>>;
  imageFrames: Partial<Record<ImageCropSlot, ImageFrameRatio>>;
  brideGroomFrame: BrideGroomFrame;
  discoverMedan: DiscoverMedanContent;
  publicInviteTypes: PublicInviteType[];
  gallery: MediaAsset[];
  events: WeddingEvent[];
  publishedAt?: string;
}

export type ImageCropSlot =
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
  | "groomPortrait";

export type ImageFrameRatio = "square" | "portrait" | "landscape";

export type BrideGroomFrame = "arch" | "oval" | "octagon" | "petal";

export interface ImageFocalPoint {
  x: number;
  y: number;
  zoom: number;
}

export interface ImageCropSettings {
  desktop: ImageFocalPoint;
  mobile: ImageFocalPoint;
}

export interface PublicInviteType {
  id: string;
  label: LocalizedString;
  code: string;
  flow: PublicInviteFlow;
  maxGuests: number;
  requireGuestNames: boolean;
  isEnabled: boolean;
  description?: LocalizedString;
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
  maxGuests: number;
  side: GuestSide;
  source?: InvitationSource;
  flow: PublicInviteFlow;
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
  additionalGuests?: AdminGuestInput[];
  message?: string;
}

export interface SelfRegistrationSubmission {
  accessCode: string;
  email: string;
  name: string;
  phone: string;
  guestCount: number;
  guestNames?: string[];
  mealPreference: Exclude<MealPreference, "unset">;
  status: Exclude<RsvpStatus, "pending">;
  eventAttendance: Partial<Record<EventKey, boolean>>;
  message?: string;
}

export interface TravelPlanSubmission {
  code: string;
  arrivalAt: string;
  departureAt: string;
  accommodationOption: TravelAccommodationOption;
  preferredRoommates?: string;
}

export interface TravelPlan {
  id: string;
  invitationGroupId: string;
  arrivalAt: string;
  departureAt: string;
  accommodationOption: TravelAccommodationOption;
  preferredRoommates?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface AdminMessageLog {
  id: string;
  invitationGroupId: string;
  channel: "whatsapp";
  messageType: AdminWhatsAppMessageType;
  recipient?: string;
  messagePreview?: string;
  sentAt: string;
  sentBy?: string;
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
  maxGuests?: number;
  side: GuestSide;
  flow: PublicInviteFlow;
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
  messageLogs: AdminMessageLog[];
  travelPlans: TravelPlan[];
}

export interface GuestCsvRow {
  groupName: string;
  greeting: string;
  name: string;
  phone?: string;
  email?: string;
  maxGuests?: number;
  side: GuestSide;
  flow: PublicInviteFlow;
  events: EventKey[];
  privateNotesEn?: string;
  privateNotesId?: string;
}
