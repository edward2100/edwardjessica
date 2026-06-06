import { getPublishedContent } from "@/lib/data-store";
import { buildWeddingCalendarIcs } from "@/lib/rsvp";

export async function GET() {
  const content = await getPublishedContent();
  const ics = buildWeddingCalendarIcs(content);

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="edward-jessica-wedding.ics"',
      "cache-control": "no-store"
    }
  });
}
