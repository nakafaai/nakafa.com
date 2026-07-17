import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import { runtimeContentRouteValidator } from "@repo/backend/convex/contents/runtime/spec";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { type Infer, v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/** Maximum route rows returned by one sitemap page. */
export const CONTENT_SITEMAP_ROUTE_PAGE_SIZE = 1000;
export const PUBLIC_SITEMAP_PAGE_SIZE = 1000;

/** Existing 100-row content artifacts combined into one sitemap response. */
export const CONTENT_SITEMAP_ARTIFACT_PAGE_COUNT =
  CONTENT_SITEMAP_ROUTE_PAGE_SIZE / CONTENT_ROUTE_ARTIFACT_PAGE_SIZE;

/** Public route kind owned by the dedicated context sitemap pages. */
export const PUBLIC_SITEMAP_ROUTE_KIND = "curriculum-context";

/** Matches Convex UTF-8 index order for route boundary construction. */
export function compareSitemapPaths(left: string, right: string) {
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    const leftCodePoint = left.codePointAt(leftIndex);
    const rightCodePoint = right.codePointAt(rightIndex);

    if (leftCodePoint === undefined || rightCodePoint === undefined) {
      break;
    }

    if (leftCodePoint !== rightCodePoint) {
      return leftCodePoint - rightCodePoint;
    }

    leftIndex += leftCodePoint > 0xff_ff ? 2 : 1;
    rightIndex += rightCodePoint > 0xff_ff ? 2 : 1;
  }

  return left.length - leftIndex - (right.length - rightIndex);
}

/** Stored locale total used to discover public sitemap pages in constant time. */
export const publicRouteSitemapCountValidator = v.object({
  count: v.number(),
  hash: v.string(),
  locale: localeValidator,
  pageCount: v.number(),
  syncedAt: v.number(),
});

/** Stored lexical boundaries for one bounded public sitemap page. */
export const publicRouteSitemapPageValidator = v.object({
  endPath: v.string(),
  hash: v.string(),
  locale: localeValidator,
  page: v.number(),
  routeCount: v.number(),
  startPath: v.string(),
  syncedAt: v.number(),
});

const getPublicSitemapCountArgsObjectValidator = v.object({
  locale: localeValidator,
});

export const getPublicSitemapCountArgsValidator =
  getPublicSitemapCountArgsObjectValidator.fields;
export type GetPublicSitemapCountArgs = Infer<
  typeof getPublicSitemapCountArgsObjectValidator
>;

export const getPublicSitemapCountReturnValidator = nullable(
  v.object({
    count: v.number(),
    pageCount: v.number(),
  })
);

const getContentSitemapPageArgsObjectValidator = v.object({
  locale: localeValidator,
  page: v.number(),
  section: nakafaSectionValidator,
});

export const getContentSitemapPageArgsValidator =
  getContentSitemapPageArgsObjectValidator.fields;
export type GetContentSitemapPageArgs = Infer<
  typeof getContentSitemapPageArgsObjectValidator
>;

export const contentSitemapRouteValidator = v.object({
  date: runtimeContentRouteValidator.fields.date,
  kind: runtimeContentRouteValidator.fields.kind,
  route: runtimeContentRouteValidator.fields.route,
  section: runtimeContentRouteValidator.fields.section,
  syncedAt: runtimeContentRouteValidator.fields.syncedAt,
});

export type ContentSitemapRoute = Infer<typeof contentSitemapRouteValidator>;

export const getContentSitemapPageReturnValidator = nullable(
  v.object({ routes: v.array(contentSitemapRouteValidator) })
);

const getPublicSitemapPageArgsObjectValidator = v.object({
  locale: localeValidator,
  page: v.number(),
});

export const getPublicSitemapPageArgsValidator =
  getPublicSitemapPageArgsObjectValidator.fields;
export type GetPublicSitemapPageArgs = Infer<
  typeof getPublicSitemapPageArgsObjectValidator
>;

export const getPublicSitemapPageReturnValidator = nullable(
  v.object({
    paths: v.array(v.string()),
    syncedAt: v.number(),
  })
);

export const publicSitemapSyncResultValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

export const publicSitemapDeleteResultValidator = v.object({
  deleted: v.number(),
});

export const publicRouteSitemapCountReturnValidator = nullable(
  publicRouteSitemapCountValidator
);

export type PublicRouteSitemapCount = Infer<
  typeof publicRouteSitemapCountValidator
>;
export type PublicRouteSitemapPage = Infer<
  typeof publicRouteSitemapPageValidator
>;
