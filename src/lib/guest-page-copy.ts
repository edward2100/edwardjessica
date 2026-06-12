import type { Language } from "@/lib/types";

type TravelPageCopy = {
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  viewDetails: string;
  backToInvite: string;
  travelTitle: string;
  travelIntro: string;
  arrivalTitle: string;
  airport: string;
  transport: string;
  fromAirport: string;
  railink: string;
  trainSchedule: string;
  trainScheduleFrom: string;
  railinkAfter: string;
  taxi: string;
  accommodationTitle: string;
  accommodation: string;
  roomsTitle: string;
  roomDeluxe: string;
  roomApartment: string;
  formTitle: string;
  formIntro: string;
  familyAccommodationNote: string;
  lockedTitle: string;
  lockedCopy: string;
  declinedTitle: string;
  declinedCopy: string;
  rsvpHere: string;
  invalidCode: string;
  arrivalField: string;
  departureField: string;
  accommodationField: string;
  specificRoommates: string;
  preferredRoommates: string;
  roommatePlaceholder: string;
  assignRoommates: string;
  ownAccommodation: string;
  submit: string;
  saving: string;
  saved: string;
  unable: string;
};

type DiscoverMedanCopy = {
  kicker: string;
  title: string;
  subtitle: string;
  viewGuide: string;
  introEyebrow: string;
  introTitle: string;
  introParagraphs: string[];
  localFoodEyebrow: string;
  localFoodTitle: string;
  localFoodIntro: string;
  localFoodItems: { name: string; note: string }[];
  supperEyebrow: string;
  supperTitle: string;
  supperIntro: string;
  supperItems: { name: string; note: string }[];
  cafeEyebrow: string;
  cafeTitle: string;
  cafeIntro: string;
  cafeItems: { name: string; note: string }[];
  placesEyebrow: string;
  placesTitle: string;
  placesIntro: string;
  placesItems: { name: string; note: string }[];
};

export const travelPageCopy: Record<Language, TravelPageCopy> = {
  en: {
    heroKicker: "",
    heroTitle: "Travel & Accommodation",
    heroSubtitle:
      "A little guide to help you arrive, settle in, and enjoy Medan with us.",
    viewDetails: "View travel details",
    backToInvite: "Back to invite",
    travelTitle: "Travel",
    travelIntro: "We are so excited to celebrate with you in Medan!",
    arrivalTitle: "Arrival in Medan",
    airport: "The nearest airport is Kualanamu International Airport (KNO).",
    transport:
      "Complimentary transport from KNO to Grand City Hall Medan will be provided for guests arriving on 11 December, and for departure on 13 December.",
    fromAirport: "From the airport, you may travel to the city centre via:",
    railink:
      "Kualanamu Airport Railink Services (ARS), which takes you directly to Medan station.",
    trainSchedule: "Train Schedule:",
    trainScheduleFrom: "(From Kualanamu)",
    railinkAfter:
      "From the station, you can walk 450m to Grand City Hall Medan or take a Grab ride.",
    taxi: "Taxi or Grab ride, available directly from the airport.",
    accommodationTitle: "Accommodation",
    accommodation:
      "Accommodation will be provided at Grand City Hall Medan on a shared-room basis from 11-13 December.",
    roomsTitle: "Available room types:",
    roomDeluxe: "Standard deluxe room for 2 pax",
    roomApartment: "2-bedroom apartment for 3 pax, limited availability",
    formTitle: "Submit your travel plans",
    formIntro:
      "Let us know your arrival, departure, and accommodation preference so we can coordinate the rooming and airport transport. We will let you know the final room plan, pick-up time, and departure transport time closer to the date.",
    familyAccommodationNote:
      "Accommodation for family guests will be coordinated directly with the family.",
    lockedTitle: "RSVP first to unlock this form",
    lockedCopy:
      "This page can be viewed anytime, but travel details can only be submitted after your RSVP has been received.",
    declinedTitle: "No travel details needed",
    declinedCopy:
      "Your RSVP is currently marked as not attending, so no travel details are needed. If your plans change, please update your RSVP first.",
    rsvpHere: "RSVP here",
    invalidCode:
      "We could not find this overseas invitation code. Please reopen this page from your RSVP confirmation or invite link.",
    arrivalField: "Arrival date and time in Medan",
    departureField: "Departure date and time from Medan",
    accommodationField: "Accommodation preference",
    specificRoommates: "I would like to room with specific guests",
    preferredRoommates: "Please provide the name of your preferred roommates",
    roommatePlaceholder:
      "1. Your name\n2. Roommate 1 name\n3. Roommate 2 name (if you would like the 2-bedroom apartment)",
    assignRoommates: "I am happy for the couple to assign my roommate",
    ownAccommodation: "I will arrange my own accommodation",
    submit: "Submit travel plans",
    saving: "Saving...",
    saved:
      "Travel plans received. Thank you! We will let you know the final room plan, pick-up time, and departure transport time closer to the date.",
    unable: "We could not save your travel plans. Please try again.",
  },
  id: {
    heroKicker: "",
    heroTitle: "Perjalanan & Akomodasi",
    heroSubtitle:
      "Panduan kecil agar perjalanan, kedatangan, dan waktu Anda di Medan terasa lebih nyaman.",
    viewDetails: "Lihat detail perjalanan",
    backToInvite: "Kembali ke undangan",
    travelTitle: "Perjalanan",
    travelIntro:
      "Kami sangat senang dapat merayakan hari ini bersama Anda di Medan!",
    arrivalTitle: "Kedatangan di Medan",
    airport: "Bandara terdekat adalah Kualanamu International Airport (KNO).",
    transport:
      "Transportasi gratis dari KNO ke Grand City Hall Medan akan disediakan untuk tamu yang tiba pada 11 Desember, dan untuk kepulangan pada 13 Desember.",
    fromAirport: "Dari bandara, Anda dapat menuju pusat kota melalui:",
    railink:
      "Kualanamu Airport Railink Services (ARS), yang membawa Anda langsung ke stasiun Medan.",
    trainSchedule: "Jadwal kereta:",
    trainScheduleFrom: "(Dari Kualanamu)",
    railinkAfter:
      "Dari stasiun, Anda dapat berjalan kaki 450m ke Grand City Hall Medan atau menggunakan Grab.",
    taxi: "Taksi atau Grab, tersedia langsung dari bandara.",
    accommodationTitle: "Akomodasi",
    accommodation:
      "Akomodasi akan disediakan di Grand City Hall Medan dengan konsep kamar bersama pada 11-13 Desember.",
    roomsTitle: "Tipe kamar yang tersedia:",
    roomDeluxe: "Standard deluxe room untuk 2 orang",
    roomApartment: "Apartemen 2 kamar untuk 3 orang, ketersediaan terbatas",
    formTitle: "Kirim rencana perjalanan Anda",
    formIntro:
      "Mohon isi waktu kedatangan, kepulangan, dan preferensi akomodasi agar kami dapat mengatur kamar dan transportasi bandara. Kami akan mengabari rencana kamar final, waktu penjemputan, dan waktu transportasi kepulangan menjelang tanggal acara.",
    familyAccommodationNote:
      "Akomodasi untuk keluarga akan dikoordinasikan langsung bersama keluarga.",
    lockedTitle: "RSVP terlebih dahulu untuk membuka formulir ini",
    lockedCopy:
      "Halaman ini dapat dilihat kapan saja, tetapi detail perjalanan hanya dapat dikirim setelah RSVP Anda diterima.",
    declinedTitle: "Detail perjalanan tidak diperlukan",
    declinedCopy:
      "RSVP Anda saat ini tercatat tidak hadir, jadi detail perjalanan tidak diperlukan. Jika rencana Anda berubah, mohon perbarui RSVP terlebih dahulu.",
    rsvpHere: "RSVP di sini",
    invalidCode:
      "Kami tidak dapat menemukan kode undangan overseas ini. Mohon buka halaman ini dari konfirmasi RSVP atau tautan undangan Anda.",
    arrivalField: "Tanggal dan jam kedatangan di Medan",
    departureField: "Tanggal dan jam kepulangan dari Medan",
    accommodationField: "Preferensi akomodasi",
    specificRoommates: "Saya ingin sekamar dengan tamu tertentu",
    preferredRoommates: "Mohon tuliskan nama teman sekamar yang diinginkan",
    roommatePlaceholder:
      "1. Nama Anda\n2. Nama teman sekamar 1\n3. Nama teman sekamar 2 (jika ingin apartemen 2 kamar)",
    assignRoommates:
      "Saya bersedia jika pasangan pengantin menentukan teman sekamar saya",
    ownAccommodation: "Saya akan mengatur akomodasi sendiri",
    submit: "Kirim rencana perjalanan",
    saving: "Menyimpan...",
    saved:
      "Rencana perjalanan diterima. Terima kasih! Kami akan mengabari rencana kamar final, waktu penjemputan, dan waktu transportasi kepulangan menjelang tanggal acara.",
    unable:
      "Kami belum dapat menyimpan rencana perjalanan Anda. Mohon coba lagi.",
  },
};

export const discoverMedanCopy: Record<Language, DiscoverMedanCopy> = {
  en: {
    kicker: "",
    title: "Discover Medan",
    subtitle: "A personal guide from the city that shaped us.",
    viewGuide: "Discover the guide",
    introEyebrow: "Welcome to Medan",
    introTitle: "A city best discovered one bite at a time",
    introParagraphs: [
      "Welcome to Medan, a city renowned for its vibrant and diverse food culture, influenced by Batak, Chinese, Minang, Malay, and Indian traditions.",
      "As two people who grew up here, we're excited to share some of our favourite local spots with you.",
      "Whether you are visiting for the wedding weekend or staying a little longer, we hope you will enjoy the flavours that make Medan special.",
    ],
    localFoodEyebrow: "Must Eat",
    localFoodTitle: "Local Food",
    localFoodIntro: "The flavors we grew up with and still look forward to whenever we come home.",
    localFoodItems: [
      {
        name: "Mie Pangsit Aon",
        note: "Jessica's all-time favorite bowl of noodles.",
      },
      {
        name: "Rumah Makan Tabona",
        note: "Famous for its rich aromatic curry.",
      },
      {
        name: "BPK Ola Kisat",
        note: "Bataknese grilled pork.",
      },
      {
        name: "Restoran Garuda",
        note: "Classic nasi padang done right.",
      },
      {
        name: "Restoran Miramar",
        note: "Authentic Indonesian dishes.",
      },
      {
        name: "Bihun Bebek Asie Kumango",
        note: "Duck vermicelli with flavorful herbal broth.",
      },
      {
        name: "Gala Seafood",
        note: "Indonesian-Chinese Zi Char, perfect for sharing.",
      },
      {
        name: "Rumah Makan Sinar Pagi",
        note: "For a comforting bowl of Soto Medan.",
      },
      {
        name: "Mie Lebong Amei",
        note: "Medan-style Hokkien Mie.",
      },
      {
        name: "Bakmi Khek Selat Panjang",
        note: "Famous noodle shop in Medan's famous food street.",
      },
      {
        name: "Mie Tiong Sim",
        note: "Generations-old noodles with nostalgic charm.",
      },
      {
        name: "Kwetiau Ahong",
        note: "Medan-style fried kwetiau cooked over charcoal fire.",
      },
    ],
    supperTitle: "Snacks & Supper Spots",
    supperEyebrow: "Late Night",
    supperIntro: "For the between-meal cravings, late-night bites, and small plates worth making room for.",
    supperItems: [
      { name: "Sate Padang Tamboh Ciek", note: "A Medan supper classic." },
      {
        name: "Martabak Piring Murni",
        note: "A must for Edward's sweet tooth.",
      },
      {
        name: "Warkop Agam",
        note: "For the Indomie becek topped with half-boiled eggs.",
      },
      { name: "Nasi Goreng Pemuda", note: "A familiar late-night favorite." },
      {
        name: "Jalan Semarang and Jalan Selat Panjang",
        note: "Food streets to wander when you want options.",
      },
    ],
    cafeTitle: "Cafes",
    cafeEyebrow: "Coffee Break",
    cafeIntro: "Easy places for a slower morning, a coffee break, or a sweet pause between wedding plans.",
    cafeItems: [
      { name: "Tip Top", note: "An old Medan classic." },
      { name: "Sultongue", note: "A cozy cafe stop." },
      { name: "Baked Goods", note: "For pastries and small treats." },
      { name: "Macehat Coffee", note: "A coffee stop with local character." },
      { name: "Earth Bake", note: "A gentle bakery moment." },
      { name: "The Thirty Six", note: "A polished place to pause." },
    ],
    placesEyebrow: "Worth a Trip",
    placesTitle: "Places to Visit",
    placesIntro:
      "A few favourite spots beyond the table — from Medan's heritage to the highlands and Lake Toba.",
    placesItems: [
      {
        name: "Tjong A Fie Mansion",
        note: "A beautifully preserved 1900s mansion blending Chinese, Malay, and European design — a window into old Medan.",
      },
      {
        name: "Lake Toba (Danau Toba)",
        note: "The vast volcanic crater lake — the largest in Southeast Asia — with Samosir Island and Batak culture at its heart.",
      },
      {
        name: "Berastagi Highlands",
        note: "A cool highland town of volcanoes, fruit markets, and mountain views, about two hours from the city.",
      },
      {
        name: "Sipiso-piso Waterfall",
        note: "One of Indonesia's tallest waterfalls, plunging about 120 metres into a gorge at the northern edge of Lake Toba.",
      },
      {
        name: "Mount Sibayak",
        note: "An active volcano above Berastagi with a beginner-friendly trail to steaming craters and sunrise views.",
      },
      {
        name: "Lumbini Natural Park",
        note: "A serene park in Berastagi crowned by a golden replica of Myanmar's Shwedagon Pagoda.",
      },
    ],
  },
  id: {
    kicker: "",
    title: "Discover Medan",
    subtitle: "Panduan pribadi dari kota yang membentuk cerita kami.",
    viewGuide: "Temukan panduan",
    introEyebrow: "Selamat datang di Medan",
    introTitle: "Kota yang paling indah dinikmati satu suapan demi satu suapan",
    introParagraphs: [
      "Selamat datang di Medan, kota yang terkenal dengan budaya kuliner yang semarak dan beragam, dipengaruhi oleh tradisi Batak, Tionghoa, Minang, Melayu, dan India.",
      "Sebagai dua orang yang tumbuh besar di sini, kami senang dapat berbagi beberapa tempat favorit kami kepada Anda.",
      "Baik Anda berkunjung untuk akhir pekan pernikahan maupun tinggal sedikit lebih lama, kami harap Anda menikmati cita rasa yang membuat Medan istimewa.",
    ],
    localFoodEyebrow: "Wajib Coba",
    localFoodTitle: "Makanan Lokal",
    localFoodIntro: "Rasa-rasa yang menemani kami bertumbuh dan selalu kami rindukan saat pulang.",
    localFoodItems: [
      {
        name: "Mie Pangsit Aon",
        note: "Semangkuk mie favorit Jessica sepanjang masa.",
      },
      {
        name: "Rumah Makan Tabona",
        note: "Terkenal dengan kari yang kaya dan aromatik.",
      },
      {
        name: "BPK Ola Kisat",
        note: "Babi panggang Karo khas Batak.",
      },
      {
        name: "Restoran Garuda",
        note: "Nasi padang klasik yang selalu pas.",
      },
      {
        name: "Restoran Miramar",
        note: "Hidangan Indonesia yang autentik.",
      },
      {
        name: "Bihun Bebek Asie Kumango",
        note: "Bihun bebek dengan kuah herbal yang kaya rasa.",
      },
      {
        name: "Gala Seafood",
        note: "Zi Char Indonesia-Tionghoa, cocok untuk makan bersama.",
      },
      {
        name: "Rumah Makan Sinar Pagi",
        note: "Untuk semangkuk Soto Medan yang menenangkan.",
      },
      {
        name: "Mie Lebong Amei",
        note: "Hokkien Mie gaya Medan.",
      },
      {
        name: "Bakmi Khek Selat Panjang",
        note: "Toko mie terkenal di salah satu jalan kuliner paling dikenal di Medan.",
      },
      {
        name: "Mie Tiong Sim",
        note: "Mie legendaris dengan rasa nostalgia.",
      },
      {
        name: "Kwetiau Ahong",
        note: "Kwetiau goreng Medan yang dimasak di atas api arang.",
      },
    ],
    supperEyebrow: "Larut Malam",
    supperTitle: "Camilan & Makan Malam",
    supperIntro: "Untuk camilan, makanan larut malam, dan rasa kecil yang tetap layak dicoba.",
    supperItems: [
      { name: "Sate Padang Tamboh Ciek", note: "Pilihan supper klasik di Medan." },
      {
        name: "Martabak Piring Murni",
        note: "Wajib untuk Edward yang suka makanan manis.",
      },
      {
        name: "Warkop Agam",
        note: "Untuk Indomie becek dengan telur setengah matang.",
      },
      { name: "Nasi Goreng Pemuda", note: "Favorit malam yang akrab." },
      {
        name: "Jalan Semarang and Jalan Selat Panjang",
        note: "Jalan kuliner untuk dijelajahi saat ingin banyak pilihan.",
      },
    ],
    cafeEyebrow: "Jeda Kopi",
    cafeTitle: "Kafe",
    cafeIntro: "Tempat santai untuk pagi yang pelan, jeda kopi, atau rehat manis di sela agenda pernikahan.",
    cafeItems: [
      { name: "Tip Top", note: "Klasik Medan yang sudah lama dikenal." },
      { name: "Sultongue", note: "Tempat kafe yang nyaman." },
      { name: "Baked Goods", note: "Untuk pastry dan camilan kecil." },
      { name: "Macehat Coffee", note: "Tempat ngopi dengan karakter lokal." },
      { name: "Earth Bake", note: "Momen bakery yang lembut." },
      { name: "The Thirty Six", note: "Tempat yang rapi untuk singgah sejenak." },
    ],
    placesEyebrow: "Layak Dikunjungi",
    placesTitle: "Tempat untuk Dikunjungi",
    placesIntro:
      "Beberapa tempat favorit di luar meja makan — dari warisan kota Medan hingga dataran tinggi dan Danau Toba.",
    placesItems: [
      {
        name: "Tjong A Fie Mansion",
        note: "Rumah megah awal 1900-an yang memadukan gaya Tionghoa, Melayu, dan Eropa — jendela menuju Medan tempo dulu.",
      },
      {
        name: "Danau Toba",
        note: "Danau kawah vulkanik terbesar di Asia Tenggara, dengan Pulau Samosir dan budaya Batak di jantungnya.",
      },
      {
        name: "Dataran Tinggi Berastagi",
        note: "Kota pegunungan yang sejuk dengan gunung berapi, pasar buah, dan pemandangan indah, sekitar dua jam dari kota.",
      },
      {
        name: "Air Terjun Sipiso-piso",
        note: "Salah satu air terjun tertinggi di Indonesia, jatuh sekitar 120 meter ke jurang di ujung utara Danau Toba.",
      },
      {
        name: "Gunung Sibayak",
        note: "Gunung berapi aktif di atas Berastagi dengan jalur ramah pemula menuju kawah berasap dan pemandangan matahari terbit.",
      },
      {
        name: "Taman Wisata Lumbini",
        note: "Taman yang tenang di Berastagi dengan replika emas Pagoda Shwedagon dari Myanmar.",
      },
    ],
  },
};
