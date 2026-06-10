import { NextResponse } from "next/server";
import {
  getInvitationByCode,
  getPublishedContent,
  submitTravelPlan,
} from "@/lib/data-store";
import { validateTravelPlanSubmission } from "@/lib/rsvp";
import { sendTravelPlanConfirmationEmail } from "@/lib/rsvp-confirmation-email";

export async function POST(request: Request) {
  try {
    const payload = validateTravelPlanSubmission(await request.json());
    const travelPlan = await submitTravelPlan(payload);
    const [content, invitation] = await Promise.all([
      getPublishedContent(),
      getInvitationByCode(payload.code),
    ]);
    if (invitation) {
      await sendTravelPlanConfirmationEmail({
        content,
        invitation,
        travelPlan,
      });
    }
    return NextResponse.json({ travelPlan });
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
