import type { PublicInviteFlow, PublicInviteType } from "@/lib/types";

// DL-9: the three built-in link types keep their dedicated routes (by type
// id); only admin-added (custom) link types are carried through navigation by
// `link`.
const DEFAULT_PUBLIC_LINK_ROUTES: Record<string, string> = {
  generic: "/jessmarried",
  family: "/family",
  overseas: "/overseas",
};

// DL-8: top-level paths owned by real routes/files. A custom link whose code
// lowercases to one of these can't use the short path (the static route
// wins), so it falls back to /invite/<CODE>.
const RESERVED_ROOT_SEGMENTS = new Set([
  "admin",
  "api",
  "assets",
  "calendar.ics",
  "discover-medan",
  "family",
  "go",
  "icon.svg",
  "invite",
  "jessmarried",
  "overseas",
  "travel-accommodation",
]);

// DL-8: a code can be a short path only if it lowercases to one clean path
// segment (letters, digits, dashes).
const PUBLIC_LINK_SLUG = /^[a-z0-9][a-z0-9-]*$/i;

/**
 * DL-8: whether a root path segment could be a public link's short path. The
 * [slug] route checks this before any database read, so stray requests
 * (/favicon.ico, /robots.txt, /wp-login.php, ...) 404 without a query.
 */
export function isPublicLinkSlug(slug: string) {
  return PUBLIC_LINK_SLUG.test(slug);
}

export function isDefaultPublicInviteType(inviteType: Pick<PublicInviteType, "id">) {
  return Object.prototype.hasOwnProperty.call(
    DEFAULT_PUBLIC_LINK_ROUTES,
    inviteType.id,
  );
}

/**
 * DL-8: short root path for a public link, its code lowercased
 * (FAMILY-AND-FRIENDS -> /family-and-friends). Falls back to /invite/<CODE>
 * when the code can't be a clean single path segment or the path belongs to
 * another page (a built-in type's own route, e.g. JESSMARRIED -> /jessmarried,
 * is kept when inviteTypeId says it is that type).
 */
export function publicLinkShortPath(code: string, inviteTypeId?: string) {
  const slug = code.trim().toLowerCase();
  const path = `/${slug}`;
  if (inviteTypeId && DEFAULT_PUBLIC_LINK_ROUTES[inviteTypeId] === path) {
    return path;
  }
  if (!isPublicLinkSlug(slug) || RESERVED_ROOT_SEGMENTS.has(slug)) {
    return `/invite/${encodeURIComponent(code.trim().toUpperCase())}`;
  }
  return path;
}

/**
 * DL-9: the `link` value to carry for a public link type: its code for custom
 * types, undefined for the built-in ones (which keep /jessmarried etc.).
 */
export function customPublicLinkCode(
  inviteType: Pick<PublicInviteType, "id" | "code"> | null | undefined,
) {
  if (!inviteType || isDefaultPublicInviteType(inviteType)) return undefined;
  return inviteType.code;
}

export function publicInvitationHref(flow: PublicInviteFlow, linkCode?: string) {
  // DL-9: a custom public link returns to its own page, not the flow default.
  if (linkCode) return publicLinkShortPath(linkCode);
  if (flow === "family") return "/family";
  if (flow === "overseas") return "/overseas";
  return "/jessmarried";
}

export function invitationHref(
  code: string | undefined,
  flow: PublicInviteFlow,
  linkCode?: string,
) {
  return code
    ? `/invite/${encodeURIComponent(code)}`
    : publicInvitationHref(flow, linkCode);
}

export function travelAccommodationHref(
  code: string | undefined,
  flow: PublicInviteFlow,
  linkCode?: string,
) {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  else {
    params.set("flow", flow);
    // DL-9: public codes travel as `link`, never as `code` (which would be
    // looked up as a personal invite and fall back to the overseas flow).
    if (linkCode) params.set("link", linkCode);
  }
  return `/travel-accommodation?${params.toString()}`;
}

export function discoverMedanHref(
  code: string | undefined,
  flow: PublicInviteFlow,
  linkCode?: string,
) {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  else {
    params.set("flow", flow);
    if (linkCode) params.set("link", linkCode);
  }
  return `/discover-medan?${params.toString()}`;
}
