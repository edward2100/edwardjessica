import type { Language, LocalizedString } from "@/lib/types";

export const languages: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "id", label: "ID" }
];

export function text(value: LocalizedString | undefined, language: Language) {
  if (!value) return "";
  return value[language] || value.en || value.id || "";
}

export const copy = {
  en: {
    weddingOf: "The Wedding of",
    genericInviteGreeting: "Dear friends & family of",
    letsBegin: "Let's Begin",
    enterCode: "Enter invitation code",
    openInvite: "Open Invitation",
    details: "Our Invitation",
    saveTheDate: "Save the Date",
    weddingDateLine: "Saturday, 12 December 2026",
    weddingDay: "Saturday",
    weddingDate: "12 December 2026",
    weddingVenueName: "Grand City Hall",
    weddingVenueCity: "Medan, Indonesia",
    schedule: "Schedule",
    scheduleTitle: "The Day’s Events",
    story: "Our Story",
    gallery: "Gallery",
    venue: "Venue",
    rsvp: "RSVP",
    privateNote: "Private Note",
    attending: "Attending",
    notAttending: "Not attending",
    pending: "Pending",
    vegetarian: "Vegetarian",
    nonVegetarian: "Non-vegetarian",
    mealPreference: "Meal preference",
    submitRsvp: "Submit RSVP",
    updateRsvp: "Update RSVP",
    addToCalendar: "Add to Calendar",
    openMap: "Open Map",
    deadlineClosed: "RSVP editing is closed.",
    invalidInvite: "Invitation not found",
    noPlusOne: "This invitation is prepared for the listed guests only.",
    parking: "Parking",
    parents: "With the blessing of our families",
    thanks: "Thank you. Your RSVP has been saved.",
    music: "Music"
  },
  id: {
    weddingOf: "Pernikahan",
    genericInviteGreeting: "Untuk keluarga & sahabat dari",
    letsBegin: "Mulai",
    enterCode: "Masukkan kode undangan",
    openInvite: "Buka Undangan",
    details: "Undangan Kami",
    saveTheDate: "Catat Tanggalnya",
    weddingDateLine: "Sabtu, 12 Desember 2026",
    weddingDay: "Sabtu",
    weddingDate: "12 Desember 2026",
    weddingVenueName: "Grand City Hall",
    weddingVenueCity: "Medan, Indonesia",
    schedule: "Jadwal",
    scheduleTitle: "Rangkaian Acara",
    story: "Kisah Kami",
    gallery: "Galeri",
    venue: "Lokasi",
    rsvp: "RSVP",
    privateNote: "Catatan Khusus",
    attending: "Hadir",
    notAttending: "Tidak hadir",
    pending: "Menunggu",
    vegetarian: "Vegetarian",
    nonVegetarian: "Non-vegetarian",
    mealPreference: "Pilihan makanan",
    submitRsvp: "Kirim RSVP",
    updateRsvp: "Perbarui RSVP",
    addToCalendar: "Tambah Kalender",
    openMap: "Buka Peta",
    deadlineClosed: "Perubahan RSVP sudah ditutup.",
    invalidInvite: "Undangan tidak ditemukan",
    noPlusOne: "Undangan ini disiapkan untuk tamu yang terdaftar.",
    parking: "Parkir",
    parents: "Dengan restu keluarga kami",
    thanks: "Terima kasih. RSVP Anda sudah tersimpan.",
    music: "Musik"
  }
} as const;
