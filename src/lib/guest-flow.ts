import { getInvitationByCode } from "@/lib/data-store";
import { normalizeInviteCode } from "@/lib/rsvp";
import type { InvitationGroup, PublicInviteFlow } from "@/lib/types";

type GuestFlowSearchParams = {
  code?: string;
  flow?: string;
};

type GuestFlowContext = {
  invitation: InvitationGroup | null;
  normalizedCode: string;
  requestedFlow: PublicInviteFlow;
};

export function isExpandedGuestFlow(flow: PublicInviteFlow) {
  return flow === "overseas" || flow === "family";
}

export function normalizePublicInviteFlow(
  value: string | undefined,
  fallback: PublicInviteFlow = "overseas",
): PublicInviteFlow {
  if (value === "generic" || value === "overseas" || value === "family") {
    return value;
  }
  return fallback;
}

export function normalizeExpandedGuestFlow(
  value: string | undefined,
  fallback: Exclude<PublicInviteFlow, "generic"> = "overseas",
): Exclude<PublicInviteFlow, "generic"> {
  return value === "family" ? "family" : fallback;
}

export async function resolveGuestFlowContext(
  searchParams: GuestFlowSearchParams,
  options: {
    fallbackFlow?: PublicInviteFlow;
    expandedOnly?: boolean;
  } = {},
): Promise<GuestFlowContext> {
  const normalizedCode = searchParams.code
    ? normalizeInviteCode(searchParams.code)
    : "";
  const invitation = normalizedCode
    ? await getInvitationByCode(normalizedCode)
    : null;
  const scopedInvitation =
    options.expandedOnly && invitation && !isExpandedGuestFlow(invitation.flow)
      ? null
      : invitation;
  if (options.expandedOnly) {
    const fallbackFlow = normalizeExpandedGuestFlow(options.fallbackFlow);

    return {
      invitation: scopedInvitation,
      normalizedCode,
      requestedFlow:
        scopedInvitation?.flow ||
        normalizeExpandedGuestFlow(searchParams.flow, fallbackFlow),
    };
  }

  const fallbackFlow = options.fallbackFlow || "overseas";
  const requestedFlow =
    scopedInvitation?.flow ||
    normalizePublicInviteFlow(searchParams.flow, fallbackFlow);

  return {
    invitation: scopedInvitation,
    normalizedCode,
    requestedFlow,
  };
}
