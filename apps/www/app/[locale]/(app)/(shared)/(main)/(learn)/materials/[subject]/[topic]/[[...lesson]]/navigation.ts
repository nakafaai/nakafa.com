import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import type { ContentPagination } from "@repo/contents/_types/content";
import { toContextualMaterialHref } from "@repo/contents/_types/route/material/context";
import type { MaterialPageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import type { PublishedMaterialContext } from "@/lib/content/material/projection";

/** Only route identity and visible labels are needed for sibling navigation. */
type MaterialNavigationRoute = Pick<
  MaterialLessonProjection,
  "appLocale" | "order" | "parentPath" | "publicPath"
> & {
  readonly metadata: Pick<MaterialLessonProjection["metadata"], "title">;
};

/** Small public navigation model shared by the static shell and client controls. */
export interface MaterialNavigationPage {
  readonly kind: MaterialPageContent["kind"];
  readonly route: Pick<
    MaterialLessonProjection,
    "appLocale" | "contentKey" | "materialKey" | "parentPath" | "publicPath"
  >;
  readonly siblings: readonly MaterialNavigationRoute[];
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
