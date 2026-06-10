import type { PublicInviteFlow } from "@/lib/types";

export function publicInvitationHref(flow: PublicInviteFlow) {
  if (flow === "family") return "/family";
  if (flow === "overseas") return "/overseas";
  return "/jessmarried";
}

export function invitationHref(code: string | undefined, flow: PublicInviteFlow) {
  return code
    ? `/invite/${encodeURIComponent(code)}`
    : publicInvitationHref(flow);
}

export function travelAccommodationHref(
  code: string | undefined,
  flow: PublicInviteFlow,
) {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  else params.set("flow", flow);
  return `/travel-accommodation?${params.toString()}`;
}

export function discoverMedanHref(
  code: string | undefined,
  flow: PublicInviteFlow,
) {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  else params.set("flow", flow);
  return `/discover-medan?${params.toString()}`;
}
