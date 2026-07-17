import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  compareSitemapPaths,
  PUBLIC_SITEMAP_PAGE_SIZE,
  type PublicRouteSitemapCount,
  type PublicRouteSitemapPage,
} from "@repo/backend/convex/contents/sitemap/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { Effect, Schema } from "effect";

const stalePageDeleteBatchSize = 500;

class PublicSitemapArtifactError extends Schema.TaggedError<PublicSitemapArtifactError>()(
  "PublicSitemapArtifactError",
  {
    code: Schema.Literal(
      "PUBLIC_SITEMAP_COUNT_INVALID",
      "PUBLIC_SITEMAP_PAGE_INVALID"
    ),
    message: Schema.String,
  }
) {}

interface SitemapSyncTotals {
  created: number;
  unchanged: number;
  updated: number;
}

/** Reads one locale's committed public sitemap count state. */
export const getPublicSitemapCountState = Effect.fn(
  "contentSync.publicSitemap.getCountState"
)(function* (ctx: QueryCtx, locale: Locale) {
  const count = yield* Effect.promise(() =>
    ctx.db
      .query("publicRouteSitemapCounts")
      .withIndex("by_locale", (query) => query.eq("locale", locale))
      .unique()
  );

  if (!count) {
    return null;
  }

  return {
    count: count.count,
    hash: count.hash,
    locale: count.locale,
    pageCount: count.pageCount,
    syncedAt: count.syncedAt,
  };
});

/** Upserts one bounded batch of public sitemap boundary pages. */
export const syncPublicSitemapPages = Effect.fn(
  "contentSync.publicSitemap.syncPages"
)(function* (ctx: MutationCtx, pages: readonly PublicRouteSitemapPage[]) {
  const totals: SitemapSyncTotals = {
    created: 0,
    unchanged: 0,
    updated: 0,
  };

  for (const page of pages) {
    yield* validatePage(page);
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("publicRouteSitemapPages")
        .withIndex("by_locale_and_page", (query) =>
          query.eq("locale", page.locale).eq("page", page.page)
        )
        .unique()
    );

    if (isSamePage(existing, page)) {
      totals.unchanged++;
      continue;
    }

    if (existing) {
      yield* Effect.promise(() =>
        ctx.db.replace("publicRouteSitemapPages", existing._id, page)
      );
      totals.updated++;
      continue;
    }

    yield* Effect.promise(() => ctx.db.insert("publicRouteSitemapPages", page));
    totals.created++;
  }

  return totals;
});

/** Deletes one bounded batch of stale public sitemap boundary pages. */
export const deleteStalePublicSitemapPages = Effect.fn(
  "contentSync.publicSitemap.deleteStalePages"
)(function* (
  ctx: MutationCtx,
  args: { firstStalePage: number; locale: Locale }
) {
  if (!Number.isSafeInteger(args.firstStalePage) || args.firstStalePage < 0) {
    return yield* invalidPage("First stale sitemap page must be non-negative.");
  }

  const pages = yield* Effect.promise(() =>
    ctx.db
      .query("publicRouteSitemapPages")
      .withIndex("by_locale_and_page", (query) =>
        query.eq("locale", args.locale).gte("page", args.firstStalePage)
      )
      .take(stalePageDeleteBatchSize)
  );

  for (const page of pages) {
    yield* Effect.promise(() =>
      ctx.db.delete("publicRouteSitemapPages", page._id)
    );
  }

  return { deleted: pages.length };
});

/** Commits one locale count only after its sitemap pages are synchronized. */
export const savePublicSitemapCount = Effect.fn(
  "contentSync.publicSitemap.saveCount"
)(function* (ctx: MutationCtx, count: PublicRouteSitemapCount) {
  yield* validateCount(count);
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("publicRouteSitemapCounts")
      .withIndex("by_locale", (query) => query.eq("locale", count.locale))
      .unique()
  );

  if (isSameCount(existing, count)) {
    return { created: 0, unchanged: 1, updated: 0 };
  }

  if (existing) {
    yield* Effect.promise(() =>
      ctx.db.replace("publicRouteSitemapCounts", existing._id, count)
    );
    return { created: 0, unchanged: 0, updated: 1 };
  }

  yield* Effect.promise(() => ctx.db.insert("publicRouteSitemapCounts", count));
  return { created: 1, unchanged: 0, updated: 0 };
});

/** Validates the exact count-to-page relationship before committing it. */
function validateCount(count: PublicRouteSitemapCount) {
  const expectedPageCount = Math.ceil(count.count / PUBLIC_SITEMAP_PAGE_SIZE);
  const valid =
    Number.isSafeInteger(count.count) &&
    count.count >= 0 &&
    Number.isSafeInteger(count.pageCount) &&
    count.pageCount === expectedPageCount;

  if (valid) {
    return Effect.void;
  }

  return Effect.fail(
    new PublicSitemapArtifactError({
      code: "PUBLIC_SITEMAP_COUNT_INVALID",
      message: "Public sitemap count does not match its bounded page count.",
    })
  );
}

/** Validates one non-empty lexical page before writing it. */
function validatePage(page: PublicRouteSitemapPage) {
  const valid =
    Number.isSafeInteger(page.page) &&
    page.page >= 0 &&
    Number.isSafeInteger(page.routeCount) &&
    page.routeCount >= 1 &&
    page.routeCount <= PUBLIC_SITEMAP_PAGE_SIZE &&
    page.startPath.length > 0 &&
    compareSitemapPaths(page.startPath, page.endPath) <= 0;

  if (valid) {
    return Effect.void;
  }

  return invalidPage("Public sitemap page boundaries or size are invalid.");
}

/** Creates the typed invalid-page failure used by artifact mutations. */
function invalidPage(message: string) {
  return Effect.fail(
    new PublicSitemapArtifactError({
      code: "PUBLIC_SITEMAP_PAGE_INVALID",
      message,
    })
  );
}

/** Checks whether one persisted page already has the same route boundaries. */
function isSamePage(
  existing: PublicRouteSitemapPage | null,
  next: PublicRouteSitemapPage
) {
  if (!existing) {
    return false;
  }

  return (
    existing.endPath === next.endPath &&
    existing.hash === next.hash &&
    existing.routeCount === next.routeCount &&
    existing.startPath === next.startPath &&
    existing.syncedAt === next.syncedAt
  );
}

/** Checks whether one committed locale count already matches the projection. */
function isSameCount(
  existing: PublicRouteSitemapCount | null,
  next: PublicRouteSitemapCount
) {
  if (!existing) {
    return false;
  }

  return (
    existing.count === next.count &&
    existing.hash === next.hash &&
    existing.pageCount === next.pageCount
  );
}
