import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import type { ContentPagination } from "@repo/contents/content";
import { toContextualMaterialHref } from "@repo/contents/route/material/context";
import type { MaterialPageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import type { PublishedMaterialContext } from "@/lib/content/material/projection";

/** Route identity that addresses one signed material in navigation. */
type MaterialNavigationIdentity = Pick<
  MaterialLessonProjection,
  "appLocale" | "contentKey" | "materialKey" | "parentPath" | "publicPath"
>;

/** Sibling route identity with the one visible label navigation shows. */
type MaterialNavigationRoute = Readonly<
  ReturnType<typeof toMaterialNavigationRoute>
>;

/** Small public navigation model shared by the static shell and client controls. */
export type MaterialNavigationPage = Readonly<
  ReturnType<typeof toMaterialNavigationPage>
>;

/** Projects one signed route to the identity and label siblings need. */
function toMaterialNavigationRoute(route: MaterialLessonProjection) {
  return {
    appLocale: route.appLocale,
    metadata: { title: route.metadata.title },
    order: route.order,
    parentPath: route.parentPath,
    publicPath: route.publicPath,
  };
}

/** Projects the signed page to the navigation model client controls receive. */
export function toMaterialNavigationPage(page: MaterialPageContent) {
  const identity: MaterialNavigationIdentity = {
    appLocale: page.route.appLocale,
    contentKey: page.route.contentKey,
    materialKey: page.route.materialKey,
    parentPath: page.route.parentPath,
    publicPath: page.route.publicPath,
  };
  return {
    kind: page.kind,
    route: identity,
    siblings: page.siblings.map(toMaterialNavigationRoute),
  };
}

const emptyItem = { href: "", title: "" };

/** Canonical localized URL for one signed material route. */
export function toMaterialHref(route: {
  readonly appLocale: MaterialLessonProjection["appLocale"];
  readonly publicPath: string;
}) {
  return `/${route.appLocale}/${route.publicPath}`;
}

/** Orders signed sibling routes by authored order and canonical path. */
function compareMaterialRoute(
  left: MaterialNavigationRoute,
  right: MaterialNavigationRoute
) {
  const order = left.order - right.order;
  return order === 0 ? left.publicPath.localeCompare(right.publicPath) : order;
}

/** Builds sibling pagination with one optional context-aware href resolver. */
function readRoutePagination(
  current: MaterialNavigationPage["route"],
  siblings: readonly MaterialNavigationRoute[],
  toHref?: (target: MaterialNavigationRoute) => string
): ContentPagination {
  const ordered = Array.from(siblings).sort(compareMaterialRoute);
  const currentIndex = ordered.findIndex(
    (sibling) => sibling.publicPath === current.publicPath
  );
  if (currentIndex < 0) {
    return { next: emptyItem, prev: emptyItem };
  }

  const toItem = (target: MaterialNavigationRoute | undefined) => {
    if (!target) {
      return emptyItem;
    }
    return {
      href: toHref?.(target) ?? toMaterialHref(target),
      title: target.metadata.title,
    };
  };
  const next = ordered[currentIndex + 1];
  const prev = ordered[currentIndex - 1];
  return {
    next: toItem(next),
    prev: toItem(prev),
  };
}

/** Builds navigation from signed routes and an already verified context. */
export function readMaterialNavigation(
  page: MaterialNavigationPage,
  published: PublishedMaterialContext | null
) {
  const currentHref = toMaterialHref(page.route);

  if (!published || page.kind === "preview") {
    return {
      context: undefined,
      currentHref,
      link: undefined,
      pagination: readRoutePagination(page.route, page.siblings),
    };
  }

  const toHref = (
    target: Pick<
      MaterialNavigationRoute,
      "appLocale" | "parentPath" | "publicPath"
    >
  ) => {
    const href = toMaterialHref(target);
    if (
      !(
        published.resolvedCanonicalPath === target.publicPath ||
        published.resolvedCanonicalPath === target.parentPath
      )
    ) {
      return href;
    }
    return toContextualMaterialHref({
      href,
      ref: published.context,
    });
  };

  return {
    context: published.context,
    currentHref: toHref(page.route),
    link: { href: published.href, label: published.label },
    pagination: readRoutePagination(page.route, page.siblings, toHref),
  };
}
