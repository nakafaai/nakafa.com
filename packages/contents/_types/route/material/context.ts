import {
  type MaterialContextIdentity,
  type MaterialContextRef,
  type MaterialRouteIdentity,
  readMaterialContextRef,
} from "@repo/contents/_types/route/material/reference";

/** Query parameter used only for validated material return-context hints. */
export const MATERIAL_CONTEXT_QUERY_PARAM = "ctx";

const MATERIAL_CONTEXT_HINT_SEPARATOR = "~";

/** Encodes one curriculum-owned context identity for material card links. */
export function encodeMaterialContextHint(context: MaterialContextIdentity) {
  return [context.programKey, context.nodeKey].join(
    MATERIAL_CONTEXT_HINT_SEPARATOR
  );
}

/**
 * Decodes the material context hint carried in a material URL query string.
 *
 * Invalid or repeated hints are ignored so stale URLs still render the
 * canonical material asset without inventing a parent context.
 */
export function readMaterialContextHint(
  value: string | readonly string[] | null | undefined
): MaterialContextIdentity | undefined {
  if (typeof value !== "string") {
    return;
  }

  const parts = value.split(MATERIAL_CONTEXT_HINT_SEPARATOR);

  if (parts.length !== 2) {
    return;
  }

  const [programKey, nodeKey] = parts;

  if (!(programKey && nodeKey)) {
    return;
  }

  return { nodeKey, programKey };
}

/**
 * Adds a validated material context hint to a canonical material href.
 *
 * The canonical path stays unchanged; the query only tells the material page
 * which curriculum card produced the navigation.
 */
export function toContextualMaterialHref({
  href,
  ref,
}: {
  href: string;
  ref: MaterialContextRef | undefined;
}) {
  if (!ref) {
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";

  return `${href}${separator}${MATERIAL_CONTEXT_QUERY_PARAM}=${encodeMaterialContextHint(
    ref
  )}`;
}

/**
 * Resolves the small header return link for a contextual material visit.
 *
 * Direct SEO material visits and stale or mismatched context hints return no
 * link, preserving the material asset as the canonical page.
 */
export function resolveMaterialHeaderLink({
  context,
  refs,
  route,
}: {
  context: string | readonly string[] | null | undefined;
  refs: readonly MaterialContextRef[];
  route: MaterialRouteIdentity;
}) {
  const hint = readMaterialContextHint(context);

  if (!hint) {
    return;
  }

  const ref = readMaterialContextRef({
    contextRoute: hint,
    refs,
    route,
  });

  if (!ref) {
    return;
  }

  return {
    href: ref.parentHref,
    label: ref.parentTitle,
  };
}

/**
 * Projects a valid material context hint to the target localized material URL.
 *
 * When the target locale lacks the same curriculum context, callers drop the
 * query and keep the canonical target material URL.
 */
export function projectMaterialContextHintToLocale({
  context,
  currentRoute,
  refs,
  targetRoute,
}: {
  context: string | readonly string[] | null | undefined;
  currentRoute: MaterialRouteIdentity;
  refs: readonly MaterialContextRef[];
  targetRoute: MaterialRouteIdentity;
}) {
  const hint = readMaterialContextHint(context);

  if (!hint) {
    return;
  }

  const currentRef = readMaterialContextRef({
    contextRoute: hint,
    refs,
    route: currentRoute,
  });

  if (!currentRef) {
    return;
  }

  const targetRef = readMaterialContextRef({
    contextRoute: currentRef,
    refs,
    route: targetRoute,
  });

  if (!targetRef) {
    return;
  }

  return encodeMaterialContextHint(targetRef);
}
