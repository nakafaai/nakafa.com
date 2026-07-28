import type { MaterialProjectionWire } from "@nakafa/aksara-contracts/projection/material";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import type { ContentPagination } from "@repo/contents/_types/content";
import {
  readMaterialPagination,
  toLocalizedContentHref,
} from "@repo/contents/_types/route/content";
import { InvalidPublicRouteSourceError } from "@repo/contents/_types/route/error";
import { readStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import { toContextualMaterialHref } from "@repo/contents/_types/route/material/context";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import {
  type PublicContentRoute,
  type PublicMaterialLessonRoute,
  PublicMaterialLessonRouteSchema,
} from "@repo/contents/_types/route/schema";
import { Either, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  readMaterialRoutes,
  requireParentMaterialRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import type {
  MaterialMetadataSource,
  MaterialPageSource,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/source";
import { getPublishedMaterialContext } from "@/lib/content/material/context";

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
  if (page.route.topicTitle !== undefined) {
    return page.route.topicTitle;
  }
  const sourceRoute = readMaterialRoutes().find(
    (route) =>
      route.locale === page.route.locale &&
      String(route.sourcePath) === String(page.route.contentKey)
  );
  if (!sourceRoute) {
    throw new InvalidPublicRouteSourceError({
      message: `Retained material projection ${page.route.contentKey}/${page.route.locale} lost its source route.`,
    });
  }
  return requireParentMaterialRoute(sourceRoute).title;
}

/** Locale counterparts owned by the selected material route source. */
export function readMaterialAlternates(source: MaterialMetadataSource) {
  if (source.kind !== "source") {
    return source.alternates;
  }
  const sourcePath = source.route.sourcePath;
  return readMaterialRoutes().filter(
    (route) => route.sourcePath === sourcePath
  );
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

/** Adapts one authenticated projection to the temporary source context seam. */
function toSourceMaterialRoute(
  projection: MaterialProjectionWire
): PublicMaterialLessonRoute {
  const decoded = Schema.decodeUnknownEither(PublicMaterialLessonRouteSchema)({
    description: projection.metadata.description,
    kind: projection.kind,
    locale: projection.locale,
    materialKey: projection.materialKey,
    order: projection.order,
    parentPath: projection.parentPath,
    publicPath: projection.publicPath,
    sectionKey: projection.sectionKey,
    sitemap: projection.sitemap,
    sourcePath: projection.contentKey,
    title: projection.metadata.title,
  });
  if (Either.isRight(decoded)) {
    return decoded.right;
  }
  throw new InvalidPublicRouteSourceError({
    message: `Published material ${projection.contentKey}/${projection.locale} cannot use source curriculum context.`,
  });
}

/** Builds plain or context-preserving pagination for published siblings. */
function readPublishedPagination(
  page: MaterialPageSource,
  context: MaterialContextIdentity | undefined
): ContentPagination {
  const current = page.route;
  const siblings = Array.from(page.siblings).sort(
    (left, right) =>
      left.order - right.order ||
      left.publicPath.localeCompare(right.publicPath)
  );
  const currentIndex = siblings.findIndex(
    (sibling) => sibling.publicPath === current.publicPath
  );
  if (currentIndex < 0) {
    return { next: emptyItem, prev: emptyItem };
  }
  /** Converts one optional sibling projection into a navigation item. */
  const toItem = (target: MaterialProjectionWire | undefined) => {
    if (!target) {
      return emptyItem;
    }
    const href = toMaterialHref(target);
    return {
      href: toContextualMaterialHref({ href, ref: context }),
      title: target.metadata.title,
    };
  };
  const next =
    currentIndex + 1 < siblings.length ? siblings[currentIndex + 1] : undefined;
  const prev = currentIndex > 0 ? siblings[currentIndex - 1] : undefined;
  return {
    next: toItem(next),
    prev: toItem(prev),
  };
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
    const pagination = readMaterialPagination(
      page.route,
      readMaterialRoutes(),
      link && context
        ? {
            toHref: (target: PublicContentRoute) =>
              index.toContextualMaterialHref({
                context,
                href: toLocalizedContentHref(target),
                route: target,
              }),
          }
        : {}
    );
    return {
      context: link ? context : undefined,
      link,
      pagination,
    };
  }
  if (!(context && page.kind === "published")) {
    return {
      context: undefined,
      link: undefined,
      pagination: readPublishedPagination(page, undefined),
    };
  }
  const published = await getPublishedMaterialContext(
    page.locale,
    page.route,
    context
  );
  if (!published.managed) {
    const index = readStaticPublicLearningIndex();
    const route = toSourceMaterialRoute(page.route);
    const link = index.resolveMaterialHeaderLink({ context, route });
    return {
      context: link ? context : undefined,
      link,
      pagination: readPublishedPagination(page, link ? context : undefined),
    };
  }
  const validContext = published.value?.context;
  return {
    context: validContext,
    link: published.value
      ? { href: published.value.href, label: published.value.label }
      : undefined,
    pagination: readPublishedPagination(page, validContext ?? undefined),
  };
}
