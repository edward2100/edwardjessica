import type { WeddingContent } from "@/lib/types";
// Satisfies the updated WeddingContent shape including images, mobileImages, imageFrames
import { createDefaultDiscoverMedanContent } from "@/lib/discover-medan-content";

export const EVENT_DATE = "2026-12-12";
export const RSVP_DEADLINE = "2026-09-01T16:59:59.000Z";
export const WEDDING_TIMEZONE = "Asia/Jakarta";

export const weddingContent: WeddingContent = {
  coupleName: "Edward & Jessica",
  groomName: "Edward",
  brideName: "Jessica",
  weddingDate: EVENT_DATE,
  timezone: WEDDING_TIMEZONE,
  rsvpDeadline: RSVP_DEADLINE,
  defaultLanguage: "en",
  openingText: {
    en: "Together with our families, we invite you to celebrate our wedding.",
    id: "Bersama keluarga kami, kami mengundang Anda untuk merayakan hari pernikahan kami.",
  },
  introText: {
    en: "With joyful hearts, we are beginning a new chapter and would be honored to share the day with you.",
    id: "Dengan hati penuh sukacita, kami memulai babak baru dan berbahagia dapat berbagi hari ini bersama Anda.",
  },
  loveStory: {
    en: "We first noticed each other in junior high in 2011, became close friends through little conversations, and got together in 2014.",
    id: "Kami pertama kali saling memperhatikan saat SMP pada tahun 2011, menjadi sahabat dekat melalui obrolan-obrolan kecil, lalu mulai bersama pada tahun 2014.",
  },
  proposalStory: {
    en: "What began as shy glances and years of friendship now brings us to our wedding day.",
    id: "Kisah yang berawal dari tatapan malu-malu dan persahabatan panjang kini membawa kami ke hari pernikahan.",
  },
  coupleBio: {
    en: "Edward is calm and thoughtful; Jessica is warm and full of joy.",
    id: "Edward tenang dan penuh perhatian; Jessica hangat dan penuh sukacita.",
  },
  parents: {
    groom: ["Brilian Moktar", "Janice Jong"],
    bride: ["Hardwin Salim", "Masria Ang"],
  },
  venue: {
    name: "Grand City Hall Medan",
    address:
      "Jl. Balai Kota No. 1, Kesawan, Kec. Medan Bar., Kota Medan, North Sumatra 20112, Indonesia",
    mapsUrl: "https://maps.app.goo.gl/hPL5x2kPToUaAK946",
    parking: {
      en: "Complimentary parking is available at the hotel basement.",
      id: "Parkir gratis tersedia di basement hotel.",
    },
  },
  notes: [
    {
      en: "Please wear socks for the holy matrimony.",
      id: "Mohon menggunakan kaus kaki untuk acara pemberkatan pernikahan.",
    },
  ],
  dressCode: {
    en: "Formal attire. Socks are required for holy matrimony.",
    id: "Busana formal. Kaus kaki diwajibkan untuk pemberkatan pernikahan.",
  },
  heroImageUrl: "/assets/wedding-hero-placeholder.png",
  invitationImageUrl:
    "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/optimized/invitation-section-20260507-196-1800-c45e87d2f4.webp",
  storyImageUrl:
    "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/optimized/story-20260507-206-1800-82592eee6f.webp",
  travelHeroImageUrl:
    "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/optimized/invitation-section-20260507-196-1800-c45e87d2f4.webp",
  travelAirportImageUrl: "/assets/kualanamu-airport-station.jpg",
  travelAccommodationImageUrl: "/assets/grand-city-hall-medan.jpg",
  travelFormImageUrl:
    "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/optimized/story-20260507-206-1800-82592eee6f.webp",
  discoverHeroImageUrl:
    "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/optimized/invitation-section-20260507-196-1800-c45e87d2f4.webp",
  discoverIntroImageUrl: "/assets/grand-city-hall-medan.jpg",
  discoverFoodImageUrl:
    "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/optimized/story-20260507-206-1800-82592eee6f.webp",
  discoverSupperImageUrl: "/assets/kualanamu-airport-station.jpg",
  discoverCafeImageUrl:
    "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/optimized/invitation-section-20260507-196-1800-c45e87d2f4.webp",
  imageCrops: {},
  images: {},
  mobileImages: {},
  imageFrames: {},
  discoverMedan: createDefaultDiscoverMedanContent(),
  publicInviteTypes: [
    {
      id: "generic",
      label: {
        en: "Friends & Family",
        id: "Keluarga & Sahabat",
      },
      code: "JESSMARRIED",
      flow: "generic",
      maxGuests: 2,
      requireGuestNames: false,
      isEnabled: true,
      description: {
        en: "General RSVP link for friends and family. Allows up to two guests and asks for a plus-one name when needed.",
        id: "Tautan RSVP umum untuk keluarga dan sahabat. Maksimal dua tamu dan meminta nama pendamping bila diperlukan.",
      },
    },
    {
      id: "overseas",
      label: {
        en: "Overseas Guests",
        id: "Tamu dari Luar Kota/Negeri",
      },
      code: "EJOVERSEAS",
      flow: "overseas",
      maxGuests: 1,
      requireGuestNames: false,
      isEnabled: true,
      description: {
        en: "Travel-focused RSVP link with accommodation and Medan guide placeholders.",
        id: "Tautan RSVP untuk perjalanan dengan bagian akomodasi dan panduan Medan.",
      },
    },
    {
      id: "family",
      label: {
        en: "Family",
        id: "Keluarga",
      },
      code: "EJFAMILY",
      flow: "family",
      maxGuests: 6,
      requireGuestNames: true,
      isEnabled: true,
      description: {
        en: "Family RSVP link. Allows up to six guests and requires every guest name.",
        id: "Tautan RSVP keluarga. Maksimal enam tamu dan wajib mengisi nama setiap tamu.",
      },
    },
  ],
  gallery: [
    {
      id: "gallery-1",
      kind: "gallery",
      url: "/assets/wedding-hero-placeholder.png",
      alt: {
        en: "Elegant wedding hall placeholder",
        id: "Placeholder aula pernikahan elegan",
      },
      sortOrder: 1,
      isPublished: true,
    },
    {
      id: "gallery-2",
      kind: "gallery",
      url: "/assets/wedding-hero-placeholder.png",
      alt: {
        en: "Champagne and white floral wedding setup",
        id: "Dekorasi pernikahan bernuansa champagne dan putih",
      },
      sortOrder: 2,
      isPublished: true,
    },
    {
      id: "gallery-3",
      kind: "gallery",
      url: "/assets/wedding-hero-placeholder.png",
      alt: {
        en: "Warm candlelit wedding reception placeholder",
        id: "Placeholder resepsi pernikahan hangat dengan lilin",
      },
      sortOrder: 3,
      isPublished: true,
    },
  ],
  events: [
    {
      key: "holy_matrimony",
      title: {
        en: "Buddhist Wedding Ceremony",
        id: "Upacara Pernikahan Buddha",
      },
      shortTitle: {
        en: "Buddhist Holy Matrimony",
        id: "Pemberkatan Pernikahan Buddha",
      },
      date: EVENT_DATE,
      startTime: "09:30",
      venueName: "Vihara Sinar Buddha (BLIA) 印尼棉蘭佛光寺",
      venueAddress: "Vihara Sinar Buddha (BLIA) 印尼棉蘭佛光寺",
      note: {
        en: "Dress Code: Socks required",
        id: "Aturan Berpakaian: Wajib kaus kaki",
      },
      mapUrl: "https://maps.app.goo.gl/D6tQ235KKhddTEnN6?g_st=ic",
    },
    {
      key: "tea_lunch",
      title: {
        en: "Tea Ceremony & Lunch Buffet",
        id: "Tea Pai & Lunch Buffet",
      },
      shortTitle: { en: "Lunch Buffet", id: "Lunch Buffet" },
      date: EVENT_DATE,
      startTime: "12:30",
      venueName: "D’Heritage - Grand City Hall Medan",
      venueAddress:
        "Jl. Balai Kota No. 1, Kesawan, Kec. Medan Bar., Kota Medan, North Sumatra 20112, Indonesia",
      mapUrl: "https://maps.app.goo.gl/hPL5x2kPToUaAK946",
    },
    {
      key: "dinner",
      title: { en: "Dinner Reception", id: "Resepsi Makan Malam" },
      shortTitle: { en: "Dinner Reception", id: "Resepsi Makan Malam" },
      date: EVENT_DATE,
      startTime: "18:30",
      venueName: "Mahogany Grand Ballroom - Grand City Hall Medan",
      venueAddress:
        "Jl. Balai Kota No. 1, Kesawan, Kec. Medan Bar., Kota Medan, North Sumatra 20112, Indonesia",
      note: {
        en: "Dress Code: Semi-formal",
        id: "Aturan Berpakaian: Semi-formal",
      },
      mapUrl: "https://maps.app.goo.gl/hPL5x2kPToUaAK946",
    },
  ],
};
