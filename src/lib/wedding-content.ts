import type { WeddingContent } from "@/lib/types";

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
    id: "Bersama keluarga kami, kami mengundang Anda untuk merayakan hari pernikahan kami."
  },
  introText: {
    en: "With joyful hearts, we are beginning a new chapter and would be honored to share the day with you.",
    id: "Dengan hati penuh sukacita, kami memulai babak baru dan berbahagia dapat berbagi hari ini bersama Anda."
  },
  loveStory: {
    en: "We first noticed each other in junior high in 2011, became close friends through little conversations, and got together in 2014.",
    id: "Kami pertama kali saling memperhatikan saat SMP pada tahun 2011, menjadi sahabat dekat melalui obrolan-obrolan kecil, lalu mulai bersama pada tahun 2014."
  },
  proposalStory: {
    en: "What began as shy glances and years of friendship now brings us to our wedding day.",
    id: "Kisah yang berawal dari tatapan malu-malu dan persahabatan panjang kini membawa kami ke hari pernikahan."
  },
  coupleBio: {
    en: "Edward is calm and thoughtful; Jessica is warm and full of joy.",
    id: "Edward tenang dan penuh perhatian; Jessica hangat dan penuh sukacita."
  },
  parents: {
    groom: ["Brilian Moktar", "Janice Jong"],
    bride: ["Hardwin Salim", "Masria Ang"]
  },
  venue: {
    name: "Grand City Hall Medan",
    address:
      "Jl. Balai Kota No. 1, Kesawan, Kec. Medan Bar., Kota Medan, North Sumatra 20112, Indonesia",
    mapsUrl: "https://maps.app.goo.gl/hPL5x2kPToUaAK946",
    parking: {
      en: "Complimentary parking is available at the hotel basement.",
      id: "Parkir gratis tersedia di basement hotel."
    }
  },
  notes: [
    {
      en: "Please wear socks for the holy matrimony.",
      id: "Mohon menggunakan kaus kaki untuk acara pemberkatan pernikahan."
    }
  ],
  dressCode: {
    en: "Formal attire. Socks are required for holy matrimony.",
    id: "Busana formal. Kaus kaki diwajibkan untuk pemberkatan pernikahan."
  },
  heroImageUrl: "/assets/wedding-hero-placeholder.png",
  invitationImageUrl:
    "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/invitation-section-20260507-196.jpg",
  storyImageUrl:
    "https://gcdydpigzlmregzcmtnv.supabase.co/storage/v1/object/public/wedding-media/gallery/story-20260507-206.jpg",
  gallery: [
    {
      id: "gallery-1",
      kind: "gallery",
      url: "/assets/wedding-hero-placeholder.png",
      alt: {
        en: "Elegant wedding hall placeholder",
        id: "Placeholder aula pernikahan elegan"
      },
      sortOrder: 1,
      isPublished: true
    },
    {
      id: "gallery-2",
      kind: "gallery",
      url: "/assets/wedding-hero-placeholder.png",
      alt: {
        en: "Champagne and white floral wedding setup",
        id: "Dekorasi pernikahan bernuansa champagne dan putih"
      },
      sortOrder: 2,
      isPublished: true
    },
    {
      id: "gallery-3",
      kind: "gallery",
      url: "/assets/wedding-hero-placeholder.png",
      alt: {
        en: "Warm candlelit wedding reception placeholder",
        id: "Placeholder resepsi pernikahan hangat dengan lilin"
      },
      sortOrder: 3,
      isPublished: true
    }
  ],
  events: [
    {
      key: "holy_matrimony",
      title: {
        en: "Buddhist Holy Matrimony",
        id: "Pemberkatan Pernikahan Buddha"
      },
      shortTitle: { en: "Holy Matrimony", id: "Pemberkatan" },
      date: EVENT_DATE,
      startTime: "09:30",
      venueName: "Grand City Hall Medan",
      venueAddress:
        "Jl. Balai Kota No. 1, Kesawan, Kec. Medan Bar., Kota Medan, North Sumatra 20112, Indonesia",
      note: {
        en: "Socks are required for this ceremony.",
        id: "Kaus kaki diwajibkan untuk acara ini."
      }
    },
    {
      key: "tea_lunch",
      title: { en: "Chinese Tea Ceremony & Lunch", id: "Tea Pai dan Makan Siang" },
      shortTitle: { en: "Tea & Lunch", id: "Tea Pai" },
      date: EVENT_DATE,
      startTime: "13:30",
      venueName: "Grand City Hall Medan",
      venueAddress:
        "Jl. Balai Kota No. 1, Kesawan, Kec. Medan Bar., Kota Medan, North Sumatra 20112, Indonesia"
    },
    {
      key: "dinner",
      title: { en: "Dinner Reception", id: "Resepsi Makan Malam" },
      shortTitle: { en: "Dinner", id: "Resepsi" },
      date: EVENT_DATE,
      startTime: "18:30",
      venueName: "Grand City Hall Medan",
      venueAddress:
        "Jl. Balai Kota No. 1, Kesawan, Kec. Medan Bar., Kota Medan, North Sumatra 20112, Indonesia",
      note: {
        en: "Guest arrival starts at 6:30 PM; dinner begins at 7:00 PM.",
        id: "Kedatangan tamu mulai pukul 18.30; makan malam dimulai pukul 19.00."
      }
    }
  ]
};
