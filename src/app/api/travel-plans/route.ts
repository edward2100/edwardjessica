import { NextResponse } from "next/server";
import {
  getInvitationByCode,
  getPublishedContent,
  submitTravelPlan,
} from "@/lib/data-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateTravelPlanSubmission } from "@/lib/rsvp";
import { sendTravelPlanConfirmationEmail } from "@/lib/rsvp-confirmation-email";

// D3: Travel plans intentionally stay open after the 12 Oct RSVP deadline so
// guests can still register travel and accommodation details closer to the
// wedding date (12 Dec 2026). This is a product decision by Edward — do not
// add an isRsvpClosed() guard here. Date-range validation is handled by
// validateTravelPlanSubmission (WP-C schema).
//
// D3: No OTP session auth required — compensated by rate limiting below.

export async function POST(request: Request) {
  // D3: rate-limit this code-only (no session) endpoint (best-effort, per-instance on serverless)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`travel:${ip}`, 10, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  try {
    const payload = validateTravelPlanSubmission(await request.json());
    const travelPlan = await submitTravelPlan(payload);
    const [content, invitation] = await Promise.all([
      getPublishedContent(),
      getInvitationByCode(payload.code),
    ]);

    // D1: email runs AFTER the successful save and can never throw past itself.
    // emailStatus is included in the response so the client can notify the guest.
    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    if (invitation) {
      const emailResult = await sendTravelPlanConfirmationEmail({
        content,
        invitation,
        travelPlan,
      }).catch((err) => {
        console.error(
          `[travel-plans] Unexpected error sending confirmation email for ${payload.code}:`,
          err,
        );
        return { status: "failed" as const, reason: String(err) };
      });
      emailStatus = emailResult.status;
      if (emailResult.status !== "sent") {
        console.error(
          `[travel-plans] Email ${emailResult.status} for invitation ${payload.code}:`,
          (emailResult as { reason?: string }).reason ?? "",
        );
      }
    }

    return NextResponse.json({ travelPlan, emailStatus });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to submit travel plans.",
      },
      { status: 400 },
    );
  }
}
