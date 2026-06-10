import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import {
  getAdminSnapshot,
  recordAdminWhatsAppMessage,
} from "@/lib/data-store";
import type { AdminWhatsAppMessageType } from "@/lib/types";

const messageTypes: AdminWhatsAppMessageType[] = [
  "invitation",
  "rsvp_confirmation",
  "travel_plans",
];

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = (await request.json()) as {
      invitationGroupId?: string;
      messageType?: AdminWhatsAppMessageType;
      recipient?: string;
      messagePreview?: string;
    };

    if (!payload.invitationGroupId) {
      return NextResponse.json(
        { error: "Invitation group is required." },
        { status: 400 },
      );
    }
    if (!payload.messageType || !messageTypes.includes(payload.messageType)) {
      return NextResponse.json(
        { error: "Message type is invalid." },
        { status: 400 },
      );
    }

    const messageLog = await recordAdminWhatsAppMessage({
      invitationGroupId: payload.invitationGroupId,
      messageType: payload.messageType,
      recipient: payload.recipient,
      messagePreview: payload.messagePreview,
      sentBy: admin.email,
    });

    return NextResponse.json({
      messageLog,
      snapshot: await getAdminSnapshot(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to record WhatsApp message.",
      },
      { status: 400 },
    );
  }
}
