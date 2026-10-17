import { formatRsvpDeadlineDate, normalizeDeadlineIso } from "@/lib/rsvp";
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
    // LR-4: late RSVPs (deadline passed, late window open). LR-7: the
    // owner asked not to show the late end date to guests (the window still
    // ends per admin Content); instead guests are asked to tell Edward or
    // Jessica on Telegram or WhatsApp. {until} (lateUntil) is still supported.
    sendLateRsvp: "Send a late RSVP",
    updateMyRsvp: "Update my RSVP",
    lateUntil: " until {date}",
    lateReachOutPending:
      "You can still send a late RSVP. If you do, we'd appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
    lateReachOutPendingNoContact:
      "You can still send a late RSVP. If you do, we'd appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
    lateReachOutResponded:
      "Need to change anything? You can still update your RSVP. If you do, we'd appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
    lateReachOutRespondedNoContact:
      "Need to change anything? You can still update your RSVP. If you do, we'd appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
    lateReachOutPublic:
      "Missed the date? You can still send a late RSVP. If you do, we'd appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
    lateReachOutPublicNoContact:
      "Missed the date? You can still send a late RSVP. If you do, we'd appreciate a quick message to Edward or Jessica on Telegram or WhatsApp too.",
    lateRsvpLabel: "Late RSVP",
    lateRsvpNotice: "Our RSVP date was {date}. We'll confirm your place with you.",
    lateChangeLabel: "Late change",
    lateChangeNotice: "Our RSVP date was {date}. We'll confirm the change with you.",
    // LR-4: the success card for a late attending answer (the heading says
    // "received", not "confirmed": the couple confirms the place).
    successLateHeading: "Thank you — we've received your late RSVP.",
    successLateChangeHeading: "Thank you — we've received your change.",
    lateRsvpReceived:
      "We'll be in touch to confirm your place. Please also give Edward or Jessica a quick heads-up on Telegram or WhatsApp.",
    lateChangeReceived:
      "We'll be in touch to confirm the change. Please also give Edward or Jessica a quick heads-up on Telegram or WhatsApp.",
    lateLookupNotFound:
      "We couldn't find an invitation for this email. You can still send a late RSVP with it.",
    // Success states
    successAttendingHeading: "Thank you — your RSVP is confirmed.",
    successAttendingSub: "See you on 12 December 2026",
    successDeclinedHeading: "Thank you for letting us know — we will miss you.",
    // Travel submitted
    travelSubmittedNote: "Your travel plans have been received.",
    updateTravelPlans: "Update travel plans",
    // SF-3: the simple RSVP form (no email code; "Yes" = the dinner reception)
    simpleFormTitle: "Will you join us?",
    simpleWhatsApp: "WhatsApp number",
    simpleWillYouAttend: "Will you attend?",
    simpleYes: "Yes, I'll attend",
    simpleNo: "Sorry, I can't",
    simpleHowMany: "How many people, including you?",
    simpleDietary: "Dietary requirements (optional)",
    simpleDietaryPlaceholder: "e.g. Vegetarian",
    simpleErrorName: "Please enter your name.",
    simpleErrorPhone: "Please enter your WhatsApp number.",
    simpleErrorEmail: "Please enter a valid email address.",
    simpleErrorAttending: "Please let us know if you can attend.",
    simpleErrorCount: "Please choose how many people are coming.",
    simpleThankYou: "Thank you, {name}!",
    simpleReceivedOne: "We've received your RSVP for 1 person.",
    simpleReceivedMany: "We've received your RSVP for {count} people.",
    simpleDeclined: "Thank you for letting us know — we'll miss you.",
    simpleChange: "Need to change anything? Message us on WhatsApp.",
    simpleChangeNoWhatsApp:
      "Need to change anything? Please contact Edward or Jessica.",
    simpleExisting:
      "We already have an RSVP for this email. To change it, message us on WhatsApp.",
    simpleExistingNoWhatsApp:
      "We already have an RSVP for this email. To change it, please contact Edward or Jessica.",
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
    // LR-4: late RSVPs — ID NEEDS REVIEW by Edward. {until} is lateUntil
    // below, or nothing when late RSVPs have no end date.
    sendLateRsvp: "Kirim RSVP terlambat",
    updateMyRsvp: "Perbarui RSVP saya",
    lateUntil: " hingga {date}",
    lateReachOutPending:
      "Anda masih dapat mengirim RSVP terlambat. Jika Anda mengirimnya, kami akan sangat menghargai jika Anda juga mengabari Edward atau Jessica melalui Telegram atau WhatsApp.",
    lateReachOutPendingNoContact:
      "Anda masih dapat mengirim RSVP terlambat. Jika Anda mengirimnya, kami akan sangat menghargai jika Anda juga mengabari Edward atau Jessica melalui Telegram atau WhatsApp.",
    lateReachOutResponded:
      "Ada yang perlu diubah? Anda masih dapat memperbarui RSVP. Jika Anda memperbaruinya, kami akan sangat menghargai jika Anda juga mengabari Edward atau Jessica melalui Telegram atau WhatsApp.",
    lateReachOutRespondedNoContact:
      "Ada yang perlu diubah? Anda masih dapat memperbarui RSVP. Jika Anda memperbaruinya, kami akan sangat menghargai jika Anda juga mengabari Edward atau Jessica melalui Telegram atau WhatsApp.",
    lateReachOutPublic:
      "Terlewat batas waktu? Anda masih dapat mengirim RSVP terlambat. Jika Anda mengirimnya, kami akan sangat menghargai jika Anda juga mengabari Edward atau Jessica melalui Telegram atau WhatsApp.",
    lateReachOutPublicNoContact:
      "Terlewat batas waktu? Anda masih dapat mengirim RSVP terlambat. Jika Anda mengirimnya, kami akan sangat menghargai jika Anda juga mengabari Edward atau Jessica melalui Telegram atau WhatsApp.",
    lateRsvpLabel: "RSVP terlambat",
    lateRsvpNotice:
      "Batas waktu RSVP kami adalah {date}. Kami akan menghubungi Anda untuk memastikan tempat Anda.",
    lateChangeLabel: "Perubahan terlambat",
    lateChangeNotice:
      "Batas waktu RSVP kami adalah {date}. Kami akan menghubungi Anda untuk memastikan perubahan ini.",
    successLateHeading: "Terima kasih — RSVP terlambat Anda sudah kami terima.",
    successLateChangeHeading: "Terima kasih — perubahan Anda sudah kami terima.",
    lateRsvpReceived:
      "Kami akan menghubungi Anda untuk memastikan tempat Anda. Mohon juga kabari Edward atau Jessica melalui Telegram atau WhatsApp.",
    lateChangeReceived:
      "Kami akan menghubungi Anda untuk memastikan perubahan ini. Mohon juga kabari Edward atau Jessica melalui Telegram atau WhatsApp.",
    lateLookupNotFound:
      "Kami tidak menemukan undangan untuk email ini. Anda masih dapat mengirim RSVP terlambat dengan email ini.",
    // Success states — ID NEEDS REVIEW by Edward
    successAttendingHeading: "Terima kasih — RSVP Anda telah dikonfirmasi.",
    successAttendingSub: "Sampai jumpa pada 12 Desember 2026",
    successDeclinedHeading:
      "Terima kasih telah memberi tahu — kami akan merindukan Anda.",
    // Travel submitted — ID NEEDS REVIEW by Edward
    travelSubmittedNote: "Rencana perjalanan Anda telah kami terima.",
    updateTravelPlans: "Perbarui rencana perjalanan",
    // SF-3: the simple RSVP form (no email code; "Ya" = resepsi makan malam)
    simpleFormTitle: "Apakah Anda akan hadir?",
    simpleWhatsApp: "Nomor WhatsApp",
    simpleWillYouAttend: "Apakah Anda dapat hadir?",
    simpleYes: "Ya, saya hadir",
    simpleNo: "Maaf, tidak bisa",
    simpleHowMany: "Berapa orang yang akan hadir, termasuk Anda?",
    simpleDietary: "Kebutuhan makanan khusus (opsional)",
    simpleDietaryPlaceholder: "mis. Vegetarian",
    simpleErrorName: "Mohon isi nama Anda.",
    simpleErrorPhone: "Mohon isi nomor WhatsApp Anda.",
    simpleErrorEmail: "Mohon isi alamat email yang valid.",
    simpleErrorAttending: "Mohon beri tahu kami apakah Anda dapat hadir.",
    simpleErrorCount: "Mohon pilih jumlah orang yang akan hadir.",
    simpleThankYou: "Terima kasih, {name}!",
    // Same wording as the plural (Indonesian has no plural form)
    simpleReceivedOne: "Kami telah menerima RSVP Anda untuk 1 orang.",
    simpleReceivedMany: "Kami telah menerima RSVP Anda untuk {count} orang.",
    simpleDeclined: "Terima kasih sudah mengabari kami — kami akan merindukan Anda.",
    simpleChange: "Ada yang perlu diubah? Kabari kami lewat WhatsApp.",
    simpleChangeNoWhatsApp:
      "Ada yang perlu diubah? Silakan hubungi Edward atau Jessica.",
    simpleExisting:
      "Kami sudah menerima RSVP untuk email ini. Untuk mengubahnya, kabari kami lewat WhatsApp.",
    simpleExistingNoWhatsApp:
      "Kami sudah menerima RSVP untuk email ini. Untuk mengubahnya, silakan hubungi Edward atau Jessica.",
  },
} as const;

// Guest-count note for a link/invitation; singular for 1 guest.
export function guestCountHintText(language: Language, count: number) {
  const c = copy[language];
  if (count === 1) return c.guestCountHintOne;
  return c.guestCountHint.replace("{count}", String(count));
}

// SF-3: the simple form's "received" line; singular for 1 person.
export function simpleReceivedText(language: Language, count: number) {
  const c = copy[language];
  if (count === 1) return c.simpleReceivedOne;
  return c.simpleReceivedMany.replace("{count}", String(count));
}

// LR-4: fills {until} in a late-RSVP template with " until 3 November 2026"
// (" hingga 3 November 2026"), or with nothing when late RSVPs have no end
// date (an invalid date counts as none, like isLateRsvpOpen).
export function lateRsvpText(
  template: string,
  language: Language,
  until: string | undefined,
  timeZone?: string,
) {
  const untilIso = normalizeDeadlineIso(until);
  const untilText = untilIso
    ? copy[language].lateUntil.replace(
        "{date}",
        formatRsvpDeadlineDate(untilIso, timeZone, language),
      )
    : "";
  return template.replace("{until}", untilText);
}

// CL-8: countdown label for a days-left value from getRsvpDaysLeft (never 0:
// the countdown is hidden once RSVP is closed). Urgent at 14 days or fewer.
export function rsvpCountdownText(language: Language, daysLeft: number) {
  const c = copy[language];
  if (daysLeft === 1) return c.daysLeftUrgentOne;
  const template = daysLeft <= 14 ? c.daysLeftUrgent : c.daysLeftRsvp;
  return template.replace("{d}", String(daysLeft));
}
