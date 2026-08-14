import type { MaterialKey } from "@nakafa/aksara-contracts/projection/material";
import type { Locale } from "@repo/contents/_types/content";

export interface MaterialRouteIdentity {
  locale: Locale;
  materialKey: MaterialKey;
  sourcePath: string;
}

export interface MaterialContextIdentity {
  nodeKey: string;
  programKey: string;
}

/**
 * Source-owned material return context for one concrete lesson and curriculum card.
 *
 * The ref is not a public route row. It only validates optional `ctx` hints and
 * builds the small header return link when a material was opened from a
 * curriculum card list.
 */
export interface MaterialContextRef extends MaterialContextIdentity {
  anchor: string;
  locale: Locale;
  materialKey: MaterialKey;
  parentHref: string;
  parentTitle: string;
  sourcePath: string;
}

/**
 * Returns the matching context ref for one material route and curriculum group.
 *
 * Curriculum card builders use this instead of reconstructing URL query
 * grammar. Missing refs keep the direct canonical material URL.
 */
export function readMaterialContextRef({
  contextRoute,
  refs,
  route,
}: {
  contextRoute: MaterialContextIdentity;
  refs: readonly MaterialContextRef[];
  route: MaterialRouteIdentity;
}) {
  return refs.find(
    (ref) =>
      ref.locale === route.locale &&
      ref.sourcePath === route.sourcePath &&
      ref.materialKey === route.materialKey &&
      ref.programKey === contextRoute.programKey &&
      ref.nodeKey === contextRoute.nodeKey
  );
}
