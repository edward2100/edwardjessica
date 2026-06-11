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
  /**
   * E2-5: true when a valid code was found but its flow is not applicable for
   * the current page (e.g. a generic-flow guest hitting the travel page which
   * requires overseas/family). The resolved invitation is still returned so the
   * page can greet the guest by name; the page must render a "not applicable"
   * notice instead of the travel form or an "invalid code" error.
   */
  codeFoundButWrongFlow?: boolean;
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
    /**
     * expandedOnly: when true, only overseas/family invitations are "active".
     * A generic invitation code is recognised and returned via
     * `codeFoundButWrongFlow` instead of being silently nulled, so pages can
     * show a graceful "this page does not apply to your invitation" state while
     * still greeting the guest by name.
     * The discover page does NOT pass expandedOnly so all flows are accepted.
     */
    expandedOnly?: boolean;
  } = {},
): Promise<GuestFlowContext> {
  const normalizedCode = searchParams.code
    ? normalizeInviteCode(searchParams.code)
    : "";
  const invitation = normalizedCode
    ? await getInvitationByCode(normalizedCode)
    : null;

  // E2-5: detect the case where the code is valid but wrong flow.
  const codeFoundButWrongFlow =
    options.expandedOnly &&
    invitation !== null &&
    !isExpandedGuestFlow(invitation.flow);

  const scopedInvitation = codeFoundButWrongFlow ? null : invitation;

  if (options.expandedOnly) {
    const fallbackFlow = normalizeExpandedGuestFlow(options.fallbackFlow);

    return {
      // E2-5: pass back the original invitation even when wrong flow so the
      // page can greet the guest; codeFoundButWrongFlow signals the UI state.
      invitation: codeFoundButWrongFlow ? invitation : scopedInvitation,
      normalizedCode,
      requestedFlow:
        scopedInvitation?.flow ||
        normalizeExpandedGuestFlow(searchParams.flow, fallbackFlow),
      codeFoundButWrongFlow: codeFoundButWrongFlow || false,
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
