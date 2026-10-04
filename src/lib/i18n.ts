import type { Language, LocalizedString } from "@/lib/types";

export const languages: { code: Language; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "id", label: "ID" },
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
    openInvitation: "Open Invitation",
    tapToOpen: "Tap to open",
    tapTakeLetter: "Tap to take out the letter",
    tapUnfold: "Tap to unfold",
    details: "Our Invitation",
    brideGroomEyebrow: "Together with our families",
    brideGroomTitle: "Groom & Bride",
    daughterOf: "Daughter of",
    sonOf: "Son of",
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
    galleryTitle: "Our Moments",
    venue: "Venue",
    rsvp: "RSVP",
    registerRsvp: "Confirm Attendance",
    readyToRsvp: "Ready to confirm?",
    rsvpSavedTitle: "RSVP received",
    confirmPresence: "Kindly confirm your presence",
    reviewBeforeRsvp:
      "Please review the wedding details above before confirming your attendance.",
    tellUsWhoIsComing: "Who will be joining us?",
    guestInfoIntro: "",
    receivedRsvp:
      "We received your RSVP. Edward & Jessica may follow up if anything needs updating.",
    adminMayFollowUp:
      "Edward & Jessica may follow up if anything needs updating",
    thankYouName: "Thank you, {name}",
    viewYourInvite: "View your invite",
    personalInviteCode: "Your personal invitation code is",
    yourName: "Your name",
    contactName: "Contact name",
    phoneWhatsApp: "Phone / WhatsApp (include country code)",
    guestCount: "Number of guests",
    guestCountHint: "This link allows up to {count} guests.",
    guestCountHintOne: "This link is for 1 guest.",
    plusOneName: "Plus-one name",
    guestNames: "Guest names",
    guestName: "Guest {number} name",
    mealChoice: "Meal preference",
    events: "Events",
    status: "Status",
    message: "Message",
    saveRsvp: "Send RSVP",
    saving: "Saving...",
    unableToSaveRsvp: "We could not save your RSVP. Please try again.",
    verifyEmailTitle: "Verify your email",
    verifyEmailIntro:
      "We will send a one-time code before opening the RSVP form.",
    inviteEmailIntro:
      "Please use the email linked to this invitation, or the email you would like us to remember for this invite.",
    emailAddress: "Email address",
    sendCode: "Send code",
    codeSent: "Code sent",
    sendingCode: "Sending...",
    enterOtpCode: "Enter email code",
    verifyCode: "Verify code",
    verifyingCode: "Verifying...",
    otpSent: "Code sent. Please check your email.",
    otpVerified: "Email verified. You can now complete the RSVP.",
    devOtpHint: "Local test code: {code}",
    checkingExistingRsvp: "Checking your RSVP...",
    openingPersonalInvite: "Opening your invitation...",
    rsvpBy: "RSVP by {date}",
    publicInviteCode: "",
    overseasTravel: "Travel & Accommodation",
    overseasTravelTitle: "Planning your trip to Medan",
    overseasTravelCopy:
      "We will add a travel form here for arrival dates, departure dates, and accommodation notes.",
    medanGuide: "Discover Medan",
    medanGuideTitle: "A little guide for your wedding trip",
    medanGuideCopy:
      "Soon this section will become a small wedding newsletter with food, places, and family-friendly ideas around Medan.",
    privateNote: "Private Note",
    attending: "Attending",
    notAttending: "Not attending",
    pending: "Pending",
    vegetarian: "Vegetarian",
    nonVegetarian: "Non-vegetarian",
    mealPreference: "Meal preference",
    submitRsvp: "Submit RSVP",
    updateRsvp: "Update RSVP",
    submitTravelPlans: "Submit your travel plans →",
    addToCalendar: "Add to Calendar",
    addFullSchedule: "Add to Calendar",
    openMap: "Open Map",
    deadlineClosed: "RSVP editing is closed.",
    invalidInvite: "Invitation not found",
    noPlusOne: "This invitation is prepared for the listed guests only.",
    parking: "Parking",
    parents: "With the blessing of our families",
    thanks: "Thank you. Your RSVP has been saved.",
    music: "Music",
    // F6: location button
    location: "Location",
    // OTP resend
    resendCode: "Resend code",
    resendCodeIn: "Resend in {s}s",
    // Countdown
    daysLeftRsvp: "{d} days left to RSVP",
    daysLeftUrgent: "RSVP closes soon — {d} days left",
    // CL-8: singular form (1 day is always inside the 14-day urgent window)
    daysLeftUrgentOne: "RSVP closes soon — 1 day left",
    // RSVP closed state
    rsvpClosed: "RSVP is now closed",
    rsvpClosedContact: "Please contact us directly for any changes.",
    // CL-1: the guest's own status on the closed card
    closedStatusPending: "We didn't receive an RSVP from you before the deadline.",
    closedStatusAttending:
      "You're confirmed as attending — we can't wait to celebrate with you.",
    closedStatusDeclined: "You let us know you can't make it — we'll miss you.",
    closedGuestsAttending: "{count} guests attending",
    closedGuestAttendingOne: "1 guest attending",
    // CL-3: lead-in above the WhatsApp / email links
    closedReachOut: "Need to change anything? Please get in touch with us:",
    closedReachOutPending:
      "If you'd still like to join us, please get in touch with us:",
    contactWhatsApp: "Message us on WhatsApp",
    contactEmail: "Email us",
    // CL-7: returning guests on a closed public link
    alreadyRegisteredOpen: "Already registered? Open my invitation",
    closedLookupTitle: "Find your invitation",
    closedLookupIntro:
      "Enter the email you registered with. We'll send a one-time code and open your invitation.",
    closedLookupNotFound:
      "We couldn't find an invitation for this email. RSVP is now closed, so new registrations are no longer possible.",
    tryAnotherEmail: "Try another email",
    // Success states
    successAttendingHeading: "Thank you — your RSVP is confirmed.",
    successAttendingSub: "See you on 12 December 2026",
    successDeclinedHeading: "Thank you for letting us know — we will miss you.",
    // Travel submitted
    travelSubmittedNote: "Your travel plans have been received.",
    updateTravelPlans: "Update travel plans",
  },
  id: {
    weddingOf: "Pernikahan",
    genericInviteGreeting: "Untuk keluarga & sahabat dari",
    // G7: letsBegin and openInvite were missing from the ID key set — added below.
    // These translations should be reviewed by Edward/Jessica for tone.
    letsBegin: "Mari Mulai",
    openInvite: "Buka Undangan",
    enterCode: "Masukkan kode undangan",
    openInvitation: "Buka Undangan",
    tapToOpen: "Ketuk untuk membuka",
    tapTakeLetter: "Ketuk untuk mengeluarkan surat",
    tapUnfold: "Ketuk untuk membuka lipatan",
    details: "Undangan Kami",
    brideGroomEyebrow: "Bersama keluarga kami",
    brideGroomTitle: "Mempelai",
    daughterOf: "Putri dari",
    sonOf: "Putra dari",
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
    galleryTitle: "Momen Kami",
    venue: "Lokasi",
    rsvp: "RSVP",
    registerRsvp: "Konfirmasi Kehadiran",
    readyToRsvp: "Siap konfirmasi?",
    rsvpSavedTitle: "RSVP diterima",
    confirmPresence: "Mohon konfirmasi kehadiran Anda",
    reviewBeforeRsvp:
      "Mohon membaca detail acara di atas sebelum mengonfirmasi kehadiran.",
    tellUsWhoIsComing: "Siapa yang akan hadir bersama Anda?",
    guestInfoIntro: "",
    receivedRsvp:
      "Kami sudah menerima RSVP Anda. Edward & Jessica akan menghubungi jika ada yang perlu diperbarui.",
    adminMayFollowUp:
      "Edward & Jessica akan menghubungi jika ada yang perlu diperbarui",
    thankYouName: "Terima kasih, {name}",
    viewYourInvite: "Lihat undangan Anda",
    personalInviteCode: "Kode undangan pribadi Anda adalah",
    yourName: "Nama Anda",
    contactName: "Nama kontak",
    phoneWhatsApp: "Nomor telepon / WhatsApp (sertakan kode negara)",
    guestCount: "Jumlah tamu",
    guestCountHint: "Tautan ini berlaku untuk maksimal {count} tamu.",
    // Same wording as the plural (Indonesian has no plural form)
    guestCountHintOne: "Tautan ini berlaku untuk maksimal 1 tamu.",
    plusOneName: "Nama pendamping",
    guestNames: "Nama tamu",
    guestName: "Nama tamu {number}",
    mealChoice: "Pilihan makanan",
    events: "Acara",
    status: "Status",
    message: "Pesan",
    saveRsvp: "Kirim RSVP",
    saving: "Menyimpan...",
    unableToSaveRsvp: "Kami belum dapat menyimpan RSVP Anda. Mohon coba lagi.",
    verifyEmailTitle: "Verifikasi email Anda",
    verifyEmailIntro:
      "Kami akan mengirim kode sekali pakai sebelum formulir RSVP dibuka.",
    inviteEmailIntro:
      "Mohon gunakan email yang terhubung dengan undangan ini, atau email yang ingin kami simpan untuk undangan ini.",
    emailAddress: "Alamat email",
    sendCode: "Kirim kode",
    codeSent: "Kode terkirim",
    sendingCode: "Mengirim...",
    enterOtpCode: "Masukkan kode email",
    verifyCode: "Verifikasi kode",
    verifyingCode: "Memverifikasi...",
    otpSent: "Kode terkirim. Mohon cek email Anda.",
    otpVerified: "Email terverifikasi. Anda dapat melanjutkan RSVP.",
    devOtpHint: "Kode tes lokal: {code}",
    checkingExistingRsvp: "Memeriksa RSVP Anda...",
    openingPersonalInvite: "Membuka undangan Anda...",
    rsvpBy: "RSVP sebelum {date}",
    publicInviteCode: "",
    overseasTravel: "Perjalanan & Akomodasi",
    overseasTravelTitle: "Merencanakan perjalanan ke Medan",
    overseasTravelCopy:
      "Kami akan menambahkan formulir perjalanan di sini untuk tanggal kedatangan, tanggal kepulangan, dan catatan akomodasi.",
    medanGuide: "Discover Medan",
    medanGuideTitle: "Panduan kecil untuk perjalanan pernikahan Anda",
    medanGuideCopy:
      "Bagian ini akan menjadi newsletter kecil berisi makanan, tempat, dan ide kegiatan keluarga di sekitar Medan.",
    privateNote: "Catatan Khusus",
    attending: "Hadir",
    notAttending: "Tidak hadir",
    pending: "Menunggu",
    vegetarian: "Vegetarian",
    nonVegetarian: "Non-vegetarian",
    mealPreference: "Pilihan makanan",
    submitRsvp: "Kirim RSVP",
    updateRsvp: "Perbarui RSVP",
    submitTravelPlans: "Kirim rencana perjalanan Anda →",
    addToCalendar: "Tambah Kalender",
    addFullSchedule: "Tambah Kalender",
    openMap: "Buka Peta",
    deadlineClosed: "Perubahan RSVP sudah ditutup.",
    invalidInvite: "Undangan tidak ditemukan",
    noPlusOne: "Undangan ini disiapkan untuk tamu yang terdaftar.",
    parking: "Parkir",
    parents: "Dengan restu keluarga kami",
    thanks: "Terima kasih. RSVP Anda sudah tersimpan.",
    music: "Musik",
    // F6: location button — ID same as EN per plan (copy kept consistent)
    location: "Lokasi",
    // OTP resend — ID NEEDS REVIEW by Edward
    resendCode: "Kirim ulang kode",
    resendCodeIn: "Kirim ulang dalam {s} dtk",
    // Countdown — ID NEEDS REVIEW by Edward
    daysLeftRsvp: "{d} hari lagi untuk RSVP",
    daysLeftUrgent: "RSVP segera ditutup — {d} hari lagi",
    // CL-8: same wording as the plural (Indonesian has no plural form)
    daysLeftUrgentOne: "RSVP segera ditutup — 1 hari lagi",
    // RSVP closed state — ID NEEDS REVIEW by Edward
    rsvpClosed: "RSVP telah ditutup",
    rsvpClosedContact: "Silakan hubungi kami langsung untuk perubahan.",
    // CL-1 / CL-3 / CL-7: closed-state copy — ID NEEDS REVIEW by Edward
    closedStatusPending: "Kami belum menerima RSVP dari Anda hingga batas waktu.",
    closedStatusAttending:
      "Kehadiran Anda sudah terkonfirmasi — kami tidak sabar merayakan hari bahagia ini bersama Anda.",
    closedStatusDeclined:
      "Anda telah mengabarkan bahwa Anda tidak dapat hadir — kami akan merindukan Anda.",
    closedGuestsAttending: "{count} tamu hadir",
    closedGuestAttendingOne: "1 tamu hadir",
    closedReachOut: "Ada yang perlu diubah? Silakan hubungi kami:",
    closedReachOutPending: "Jika Anda masih ingin hadir, silakan hubungi kami:",
    contactWhatsApp: "Hubungi kami via WhatsApp",
    contactEmail: "Kirim email kepada kami",
    alreadyRegisteredOpen: "Sudah terdaftar? Buka undangan saya",
    closedLookupTitle: "Temukan undangan Anda",
    closedLookupIntro:
      "Masukkan email yang Anda gunakan saat mendaftar. Kami akan mengirim kode sekali pakai lalu membuka undangan Anda.",
    closedLookupNotFound:
      "Kami tidak menemukan undangan untuk email ini. RSVP telah ditutup, sehingga pendaftaran baru tidak dapat dilakukan lagi.",
    tryAnotherEmail: "Coba email lain",
    // Success states — ID NEEDS REVIEW by Edward
    successAttendingHeading: "Terima kasih — RSVP Anda telah dikonfirmasi.",
    successAttendingSub: "Sampai jumpa pada 12 Desember 2026",
    successDeclinedHeading:
      "Terima kasih telah memberi tahu — kami akan merindukan Anda.",
    // Travel submitted — ID NEEDS REVIEW by Edward
    travelSubmittedNote: "Rencana perjalanan Anda telah kami terima.",
    updateTravelPlans: "Perbarui rencana perjalanan",
  },
} as const;

// Guest-count note for a link/invitation; singular for 1 guest.
export function guestCountHintText(language: Language, count: number) {
  const c = copy[language];
  if (count === 1) return c.guestCountHintOne;
  return c.guestCountHint.replace("{count}", String(count));
}

// CL-8: countdown label for a days-left value from getRsvpDaysLeft (never 0:
// the countdown is hidden once RSVP is closed). Urgent at 14 days or fewer.
export function rsvpCountdownText(language: Language, daysLeft: number) {
  const c = copy[language];
  if (daysLeft === 1) return c.daysLeftUrgentOne;
  const template = daysLeft <= 14 ? c.daysLeftUrgent : c.daysLeftRsvp;
  return template.replace("{d}", String(daysLeft));
}
