insert into admin_profiles (email, display_name, role)
values
  ('edward@example.com', 'Edward', 'super_admin'),
  ('jessica@example.com', 'Jessica', 'super_admin')
on conflict (email) do update set display_name = excluded.display_name;

insert into site_settings (key, value)
values
  ('event_timezone', '"Asia/Jakarta"'::jsonb),
  ('rsvp_deadline', '"2026-10-12T16:59:59.000Z"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into content_versions (status, content, published_at)
values (
  'published',
  '{
    "coupleName": "Edward & Jessica",
    "groomName": "Edward",
    "brideName": "Jessica",
    "weddingDate": "2026-12-12",
    "timezone": "Asia/Jakarta",
    "rsvpDeadline": "2026-10-12T16:59:59.000Z",
    "defaultLanguage": "en",
    "openingText": {
      "en": "Together with our families, we invite you to celebrate our wedding.",
      "id": "Bersama keluarga kami, kami mengundang Anda untuk merayakan hari pernikahan kami."
    },
    "introText": {
      "en": "With joyful hearts, we are beginning a new chapter and would be honored to share the day with you.",
      "id": "Dengan hati penuh sukacita, kami memulai babak baru dan berbahagia dapat berbagi hari ini bersama Anda."
    },
    "loveStory": {
      "en": "We first noticed each other in junior high in 2011, became close friends through little conversations, and got together in 2014.",
      "id": "Kami pertama kali saling memperhatikan saat SMP pada tahun 2011, menjadi sahabat dekat melalui obrolan-obrolan kecil, lalu mulai bersama pada tahun 2014."
    },
    "proposalStory": {
      "en": "What began as shy glances and years of friendship now brings us to our wedding day.",
      "id": "Kisah yang berawal dari tatapan malu-malu dan persahabatan panjang kini membawa kami ke hari pernikahan."
    },
    "coupleBio": {
      "en": "Edward is calm and thoughtful; Jessica is warm and full of joy.",
      "id": "Edward tenang dan penuh perhatian; Jessica hangat dan penuh sukacita."
    },
    "parents": {
      "groom": ["Brilian Moktar", "Janice Jong"],
      "bride": ["Hardwin Salim", "Masria Ang"]
    },
    "venue": {
      "name": "Grand City Hall Medan",
      "address": "Jl. Balai Kota No. 1, Kesawan, Kec. Medan Bar., Kota Medan, North Sumatra 20112, Indonesia",
      "mapsUrl": "https://maps.app.goo.gl/hPL5x2kPToUaAK946",
      "parking": {
        "en": "Complimentary parking is available at the hotel basement.",
        "id": "Parkir gratis tersedia di basement hotel."
      }
    },
    "notes": [
      {
        "en": "Please wear socks for the holy matrimony.",
        "id": "Mohon menggunakan kaus kaki untuk acara pemberkatan pernikahan."
      }
    ],
    "dressCode": {
      "en": "Formal attire. Socks are required for holy matrimony.",
      "id": "Busana formal. Kaus kaki diwajibkan untuk pemberkatan pernikahan."
    },
    "heroImageUrl": "/assets/wedding-hero-placeholder.png",
    "gallery": [],
    "events": []
  }'::jsonb,
  now()
);
