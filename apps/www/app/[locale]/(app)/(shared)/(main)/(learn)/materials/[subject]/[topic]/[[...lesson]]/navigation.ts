import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import type { ContentPagination } from "@repo/contents/_types/content";
import { toContextualMaterialHref } from "@repo/contents/_types/route/material/context";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import type { MaterialPageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import { getPublishedMaterialContext } from "@/lib/content/material/context";

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
  left: MaterialLessonProjection,
  right: MaterialLessonProjection
) {
  const order = left.order - right.order;
  return order === 0 ? left.publicPath.localeCompare(right.publicPath) : order;
}

/** Builds sibling pagination with one optional context-aware href resolver. */
function readRoutePagination(
  current: MaterialLessonProjection,
  siblings: readonly MaterialLessonProjection[],
  toHref?: (target: MaterialLessonProjection) => string
): ContentPagination {
  const ordered = Array.from(siblings).sort(compareMaterialRoute);
  const currentIndex = ordered.findIndex(
    (sibling) => sibling.publicPath === current.publicPath
  );
  if (currentIndex < 0) {
    return { next: emptyItem, prev: emptyItem };
  }

  const toItem = (target: MaterialLessonProjection | undefined) => {
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

/** Resolves one verified curriculum link and signed sibling pagination model. */
export async function readMaterialNavigation(
  page: MaterialPageContent,
  context: MaterialContextIdentity | undefined
) {
  const currentHref = toMaterialHref(page.route);

  if (!context || page.kind === "preview") {
    return {
      context: undefined,
      currentHref,
      link: undefined,
      pagination: readRoutePagination(page.route, page.siblings),
    };
  }

  const published = await getPublishedMaterialContext(
    page.appLocale,
    page.route,
    context,
    page.activeReleaseId
  );
  const toHref = (target: MaterialLessonProjection) => {
    const href = toMaterialHref(target);
    if (
      !(
        published &&
        (published.mapping.canonicalPath === target.publicPath ||
          published.mapping.canonicalPath === target.parentPath)
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
    context: published?.context,
    currentHref: toHref(page.route),
    link: published
      ? { href: published.href, label: published.label }
      : undefined,
    pagination: readRoutePagination(page.route, page.siblings, toHref),
  };
}
