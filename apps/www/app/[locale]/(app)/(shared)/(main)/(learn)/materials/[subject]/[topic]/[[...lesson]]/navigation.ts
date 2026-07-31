import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import type { ContentPagination } from "@repo/contents/_types/content";
import { isMaterialLessonRoute } from "@repo/contents/_types/route/content";
import { readStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import { toContextualMaterialHref } from "@repo/contents/_types/route/material/context";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import type { Locale } from "next-intl";
import { requireParentMaterialRoute } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import type {
  MaterialMetadataSource,
  MaterialPageSource,
  MaterialViewRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/source";
import { getPublishedMaterialContext } from "@/lib/content/material/context";
import { readMaterialRoutes } from "@/lib/content/material/shell";

const emptyItem = { href: "", title: "" };

/** Canonical localized URL for either source or published material routes. */
export function toMaterialHref(route: {
  readonly locale: Locale;
  readonly publicPath: string;
}) {
  return `/${route.locale}/${route.publicPath}`;
}

/** Stable content key consumed by views, comments, and audio identities. */
export function readMaterialContentKey(page: MaterialPageSource) {
  if (page.kind === "source") {
    return page.route.sourcePath;
  }
  return page.route.contentKey;
}

/** Topic title owned by the selected material route source. */
export function readMaterialParentTitle(page: MaterialPageSource) {
  if (page.kind === "source") {
    return requireParentMaterialRoute(page.route).title;
  }
  return page.route.topicTitle;
}

/** Locale counterparts owned by the selected material route source. */
export function readMaterialAlternates(source: MaterialMetadataSource) {
  if (source.kind === "preview") {
    return source.alternates;
  }
  const sourcePath =
    source.kind === "source"
      ? source.route.sourcePath
      : source.route.contentKey;
  const routes = readMaterialRoutes().flatMap((route) =>
    isMaterialLessonRoute(route) && route.sourcePath === sourcePath
      ? [route]
      : []
  );
  if (source.kind === "published" && source.familyManaged) {
    return source.alternates;
  }
  const alternates = new Map<Locale, MaterialViewRoute>();
  for (const route of routes) {
    alternates.set(route.locale, route);
  }
  for (const claim of source.sourceClaims) {
    if (claim.contentKey !== sourcePath) {
      continue;
    }
    if (claim.kind === "missing") {
      alternates.delete(claim.locale);
      continue;
    }
    alternates.set(claim.locale, claim.projection);
  }
  for (const route of source.alternates) {
    alternates.set(route.locale, route);
  }
  return Array.from(alternates.values());
}

/** Selects the physical material icon from verified renderer ownership. */
export function readMaterialIcon(page: MaterialPageSource) {
  if (page.rendererDomain) {
    return getMaterialIcon(page.rendererDomain);
  }
  const sourcePath =
    page.kind === "source" ? page.route.sourcePath : page.route.contentKey;
  const [, , domain] = sourcePath.split("/");
  return getMaterialIcon(domain ?? "");
}

/** Reads the authored title shared by source and published material routes. */
function readMaterialTitle(route: MaterialViewRoute) {
  return "metadata" in route ? route.metadata.title : route.title;
}

/** Orders mixed route contracts without coercing their branded paths. */
function compareMaterialRoute(
  left: MaterialViewRoute,
  right: MaterialViewRoute
) {
  const order = (left.order ?? 0) - (right.order ?? 0);
  return order === 0 ? left.publicPath.localeCompare(right.publicPath) : order;
}

/** Returns the stable source identity shared by mixed material route shapes. */
function materialRouteIdentity(route: MaterialViewRoute) {
  const contentKey =
    "contentKey" in route ? route.contentKey : route.sourcePath;
  return `${route.locale}\0${contentKey}`;
}

/** Checks whether one route still belongs to the temporary source group. */
function sharesMaterialGroup(
  current: MaterialViewRoute,
  candidate: MaterialViewRoute
) {
  return (
    current.locale === candidate.locale &&
    current.materialKey === candidate.materialKey &&
    current.parentPath === candidate.parentPath
  );
}

/** Builds sibling pagination with one optional context-aware href resolver. */
function readRoutePagination(
  current: MaterialViewRoute,
  siblings: readonly MaterialViewRoute[],
  toHref?: (target: MaterialViewRoute) => string
): ContentPagination {
  const ordered = Array.from(siblings).sort(compareMaterialRoute);
  const currentIndex = ordered.findIndex(
    (sibling) => sibling.publicPath === current.publicPath
  );
  if (currentIndex < 0) {
    return { next: emptyItem, prev: emptyItem };
  }
  /** Converts one optional sibling projection into a navigation item. */
  const toItem = (target: MaterialViewRoute | undefined) => {
    if (!target) {
      return emptyItem;
    }
    return {
      href: toHref?.(target) ?? toMaterialHref(target),
      title: readMaterialTitle(target),
    };
  };
  const next =
    currentIndex + 1 < ordered.length ? ordered[currentIndex + 1] : undefined;
  const prev = currentIndex > 0 ? ordered[currentIndex - 1] : undefined;
  return {
    next: toItem(next),
    prev: toItem(prev),
  };
}

/** Reconciles source siblings with exact claims until family cutover. */
function readShellPagination(
  page: MaterialPageSource,
  toHref?: (target: MaterialViewRoute) => string
) {
  if (
    page.kind === "preview" ||
    (page.kind === "published" && page.familyManaged)
  ) {
    return readRoutePagination(page.route, page.siblings, toHref);
  }
  const siblings = new Map<string, MaterialViewRoute>(
    page.siblings.map((route) => [materialRouteIdentity(route), route])
  );
  for (const route of readMaterialRoutes()) {
    if (
      isMaterialLessonRoute(route) &&
      sharesMaterialGroup(page.route, route)
    ) {
      siblings.set(materialRouteIdentity(route), route);
    }
  }
  for (const claim of page.sourceClaims) {
    const identity = `${claim.locale}\0${claim.contentKey}`;
    if (
      claim.kind === "missing" ||
      !sharesMaterialGroup(page.route, claim.projection)
    ) {
      siblings.delete(identity);
      continue;
    }
    siblings.set(identity, claim.projection);
  }
  for (const route of page.siblings) {
    siblings.set(materialRouteIdentity(route), route);
  }
  return readRoutePagination(page.route, Array.from(siblings.values()), toHref);
}

/** Resolves one verified header link and sibling pagination model. */
export async function readMaterialNavigation(
  page: MaterialPageSource,
  context: MaterialContextIdentity | undefined
) {
  if (page.kind === "source") {
    const index = readStaticPublicLearningIndex();
    const link = index.resolveMaterialHeaderLink({
      context,
      route: page.route,
    });
    const toHref =
      link && context
        ? (target: MaterialViewRoute) => {
            const route =
              "contentKey" in target
                ? index.resolveMaterialRouteBySource(
                    target.contentKey,
                    target.locale
                  )
                : target;
            const href = toMaterialHref(target);
            return route
              ? index.toContextualMaterialHref({ context, href, route })
              : href;
          }
        : undefined;
    return {
      context: link ? context : undefined,
      link,
      pagination: readShellPagination(page, toHref),
    };
  }
  if (!(context && page.kind === "published")) {
    return {
      context: undefined,
      link: undefined,
      pagination: readShellPagination(page),
    };
  }
  const published = await getPublishedMaterialContext(
    page.locale,
    page.route,
    context,
    page.activeReleaseId
  );
  if (!published.managed) {
    const index = readStaticPublicLearningIndex();
    const route = index.resolveMaterialRouteBySource(
      page.route.contentKey,
      page.locale
    );
    const link = route
      ? index.resolveMaterialHeaderLink({ context, route })
      : undefined;
    const toHref = link
      ? (target: MaterialViewRoute) => {
          const href = toMaterialHref(target);
          const targetRoute =
            "contentKey" in target
              ? index.resolveMaterialRouteBySource(
                  target.contentKey,
                  target.locale
                )
              : target;
          if (!targetRoute) {
            return href;
          }
          return index.toContextualMaterialHref({
            context,
            href,
            route: targetRoute,
          });
        }
      : undefined;
    return {
      context: link ? context : undefined,
      link,
      pagination: readShellPagination(page, toHref),
    };
  }
  const valid = published.value;
  const validContext = valid?.context;
  const toHref = valid
    ? (target: MaterialViewRoute) => {
        const href = toMaterialHref(target);
        if (
          !(
            valid.mapping.canonicalPath === target.publicPath ||
            valid.mapping.canonicalPath === target.parentPath
          )
        ) {
          return href;
        }
        return toContextualMaterialHref({ href, ref: valid.context });
      }
    : undefined;
  return {
    context: validContext,
    link: valid ? { href: valid.href, label: valid.label } : undefined,
    pagination: readShellPagination(page, toHref),
  };
}
