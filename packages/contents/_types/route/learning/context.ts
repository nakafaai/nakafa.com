import { toContextualMaterialHref } from "@repo/contents/_types/route/material/context";
import type {
  MaterialContextIdentity,
  MaterialContextRef,
  MaterialRouteIdentity,
} from "@repo/contents/_types/route/material/reference";
import { listMaterialContextRefs } from "@repo/contents/_types/route/material/reference";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
} from "@repo/contents/_types/route/schema";

/** Indexed material context Interface used by material and locale projection. */
export interface MaterialContextIndex {
  /** Keeps a `ctx` hint only when both source and target material routes match. */
  projectToLocale(input: {
    context: MaterialContextIdentity | undefined;
    currentRoute: MaterialRouteIdentity;
    targetRoute: MaterialRouteIdentity;
  }): MaterialContextIdentity | undefined;
  /** Returns the learner's curriculum return link for one validated material ctx. */
  resolveHeaderLink(input: {
    context: MaterialContextIdentity | undefined;
    route: MaterialRouteIdentity;
  }): { href: string; label: string } | undefined;
  /** Adds a validated context hint to one canonical material href. */
  toContextualHref(input: {
    contextRoute: MaterialContextIdentity;
    href: string;
    route: MaterialRouteIdentity;
  }): string;
}

/**
 * Builds keyed material context refs from projected material and curriculum rows.
 *
 * The resulting index is data infrastructure only. It does not create public
 * pages or sitemap rows, and stale context hints resolve to undefined rather
 * than inventing a curriculum parent for direct material visits.
 */
export function createMaterialContextIndex({
  contentRoutes,
  curriculumRoutes,
}: {
  contentRoutes: readonly PublicContentRoute[];
  curriculumRoutes: readonly PublicCurriculumRoute[];
}): MaterialContextIndex {
  const materialContextByIdentity = new Map<string, MaterialContextRef>();

  for (const ref of listMaterialContextRefs({
    contentRoutes,
    curriculumRoutes,
  })) {
    materialContextByIdentity.set(readMaterialContextRefKey(ref), ref);
  }

  return {
    projectToLocale: ({ context, currentRoute, targetRoute }) =>
      projectMaterialContextToLocale({
        context,
        currentRoute,
        materialContextByIdentity,
        targetRoute,
      }),
    resolveHeaderLink: ({ context, route }) =>
      resolveMaterialHeaderLink({
        context,
        materialContextByIdentity,
        route,
      }),
    toContextualHref: ({ contextRoute, href, route }) =>
      toContextualMaterialHref({
        href,
        ref: readMaterialContextRefFromMap({
          context: contextRoute,
          materialContextByIdentity,
          route,
        }),
      }),
  };
}

/** Preserves material context only when current and target source refs match. */
function projectMaterialContextToLocale({
  context,
  currentRoute,
  materialContextByIdentity,
  targetRoute,
}: {
  context: MaterialContextIdentity | undefined;
  currentRoute: MaterialRouteIdentity;
  materialContextByIdentity: ReadonlyMap<string, MaterialContextRef>;
  targetRoute: MaterialRouteIdentity;
}) {
  const currentRef = readMaterialContextRefFromMap({
    context,
    materialContextByIdentity,
    route: currentRoute,
  });

  if (!currentRef) {
    return;
  }

  const targetRef = readMaterialContextRefFromMap({
    context: currentRef,
    materialContextByIdentity,
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

/** Resolves the material page return link from a validated source context. */
function resolveMaterialHeaderLink({
  context,
  materialContextByIdentity,
  route,
}: {
  context: MaterialContextIdentity | undefined;
  materialContextByIdentity: ReadonlyMap<string, MaterialContextRef>;
  route: MaterialRouteIdentity;
}) {
  const ref = readMaterialContextRefFromMap({
    context,
    materialContextByIdentity,
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

/** Reads one context ref from the prebuilt material-context map. */
function readMaterialContextRefFromMap({
  context,
  materialContextByIdentity,
  route,
}: {
  context: MaterialContextIdentity | undefined;
  materialContextByIdentity: ReadonlyMap<string, MaterialContextRef>;
  route: MaterialRouteIdentity;
}) {
  if (!context) {
    return;
  }

  return materialContextByIdentity.get(
    readMaterialContextRouteKey({ context, route })
  );
}

/** Reads a material-context map key from a full context ref row. */
function readMaterialContextRefKey(ref: MaterialContextRef) {
  return readMaterialContextRouteKey({
    context: ref,
    route: ref,
  });
}

/** Builds the material/context identity key used for source-owned return links. */
function readMaterialContextRouteKey({
  context,
  route,
}: {
  context: MaterialContextIdentity;
  route: MaterialRouteIdentity;
}) {
  return [
    route.locale,
    route.sourcePath,
    route.materialKey,
    context.programKey,
    context.nodeKey,
  ].join(":");
}
