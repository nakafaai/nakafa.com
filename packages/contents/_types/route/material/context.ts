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
  context: MaterialContextIdentity | undefined;
  refs: readonly MaterialContextRef[];
  route: MaterialRouteIdentity;
}) {
  if (!context) {
    return;
  }

  const ref = readMaterialContextRef({
    contextRoute: context,
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
 * Projects a valid material context identity to the target localized material URL.
 *
 * When the target locale lacks the same curriculum context, callers drop the
 * query and keep the canonical target material URL.
 */
export function projectMaterialContextToLocale({
  context,
  currentRoute,
  refs,
  targetRoute,
}: {
  context: MaterialContextIdentity | undefined;
  currentRoute: MaterialRouteIdentity;
  refs: readonly MaterialContextRef[];
  targetRoute: MaterialRouteIdentity;
}) {
  if (!context) {
    return;
  }

  const currentRef = readMaterialContextRef({
    contextRoute: context,
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

  return {
    nodeKey: targetRef.nodeKey,
    programKey: targetRef.programKey,
  };
}
