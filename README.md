# Edward & Jessica Wedding Website

Production MVP for a bilingual wedding invitation and admin dashboard.

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS with project CSS tokens
- Supabase Auth, PostgreSQL, and Storage
- Vercel-ready deployment
- Vitest and Playwright test setup

## Local Preview

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Preview invitation codes:

- `EJ26-HARDWIN`
- `EJ26-BRILIAN`
- `EJ26-X7K92`
- Generic self-registration: `JESSmarriED`

The generic code lets unknown guests self-register immediately. After submission,
the app creates a real invitation group and generates a memorable personal code
from the guest's full name, for example `JOHNTAN`. If a duplicate exists, a
number is appended, for example `JOHNTAN2`.

Preview admin:

- `/admin/login`
- Email: `edward@example.com` or `jessica@example.com`
- Password: any value while `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` and Supabase env vars are unset

## Environment

Copy `.env.example` to `.env.local` for local work. For production on Vercel, set the same variables in Project Settings:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
RESEND_API_KEY=
RSVP_EMAIL_FROM="Edward & Jessica RSVP <rsvp@edwardjessica.com>"
RSVP_EMAIL_REPLY_TO=rsvp@edwardjessica.com
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-only. Do not expose it in browser code or public client-side variables.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Run `supabase/seed.sql`.
4. Create Auth users for Edward and Jessica.
5. Update `admin_profiles.user_id` to match their Auth user IDs.
6. Confirm the public Storage bucket `wedding-media` exists. The schema creates it automatically.
7. Set the Vercel environment variables from `.env.example`.

Guest data is served through app routes using the service role key, so invite codes do not expose the full guest list to the browser.

## Admin Features

- Dashboard metrics for invited guests, RSVP status, invite opens, and meal counts.
- Manual guest-group editing, CSV import, CSV template download, and CSV/JSON export.
- Admin RSVP override and RSVP history.
- Draft/publish content flow.
- Supabase Storage upload for hero photos, gallery photos, and music.

Media uploads are added to draft content first. Click Publish Media in Photos & Music, or Publish in Content, before expecting guests to see the new hero, gallery, or music.

## Testing

```bash
npm run qa:static
```

Live Supabase QA helpers, for local runs with `.env.local` configured:

```bash
npm run qa:supabase
npm run qa:content
npm run qa:live
```
