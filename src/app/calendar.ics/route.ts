// Serve the wedding calendar at a URL ending in ".ics" so in-app browsers
// (Telegram, Instagram, WhatsApp, etc.) — which ignore Content-Disposition and
// the download attribute and name the file from the URL's last path segment —
// produce a proper "edward-jessica-wedding.ics" that iOS opens in Calendar.
// The handler itself lives in /api/calendar; this is just an .ics-named alias.
export { GET } from "@/app/api/calendar/route";
