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
import { getDocumentSize } from "convex/values";
import { Effect, Schema } from "effect";

const stalePageDeleteBatchSize = 500;
const maximumSitemapPageDocumentBytes = 1024 * 1024;

class PublicSitemapArtifactError extends Schema.TaggedError<PublicSitemapArtifactError>()(
  "PublicSitemapArtifactError",
  {
    code: Schema.Literal(
      "PUBLIC_SITEMAP_COUNT_INVALID",
      "PUBLIC_SITEMAP_GENERATION_COLLISION",
      "PUBLIC_SITEMAP_GENERATION_STALE",
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

/** Writes one bounded batch of immutable generation-scoped sitemap pages. */
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
        .withIndex("by_locale_and_syncedAt_and_page", (query) =>
          query
            .eq("locale", page.locale)
            .eq("syncedAt", page.syncedAt)
            .eq("page", page.page)
        )
        .unique()
    );

    if (isSamePage(existing, page)) {
      totals.unchanged++;
      continue;
    }

    if (existing) {
      return yield* sitemapArtifactError(
        "PUBLIC_SITEMAP_GENERATION_COLLISION",
        `Public sitemap generation ${page.locale}/${page.syncedAt}/${page.page} already contains different paths.`
      );
    }

    yield* Effect.promise(() => ctx.db.insert("publicRouteSitemapPages", page));
    totals.created++;
  }

  return totals;
});

/** Deletes one bounded batch of pages older than the committed generation. */
export const deleteOlderPublicSitemapPages = Effect.fn(
  "contentSync.publicSitemap.deleteOlderPages"
)(function* (
  ctx: MutationCtx,
  args: { committedSyncedAt: number; locale: Locale }
) {
  if (
    !Number.isSafeInteger(args.committedSyncedAt) ||
    args.committedSyncedAt <= 0
  ) {
    return yield* invalidPage(
      "Committed public sitemap generation must be a positive integer."
    );
  }

  const pages = yield* Effect.promise(() =>
    ctx.db
      .query("publicRouteSitemapPages")
      .withIndex("by_locale_and_syncedAt_and_page", (query) =>
        query.eq("locale", args.locale).lt("syncedAt", args.committedSyncedAt)
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

  if (existing?.syncedAt === count.syncedAt) {
    if (isSameCount(existing, count)) {
      return { created: 0, unchanged: 1, updated: 0 };
    }

    return yield* sitemapArtifactError(
      "PUBLIC_SITEMAP_GENERATION_COLLISION",
      `Public sitemap generation ${count.locale}/${count.syncedAt} already has different count metadata.`
    );
  }

  if (existing && existing.syncedAt > count.syncedAt) {
    return yield* sitemapArtifactError(
      "PUBLIC_SITEMAP_GENERATION_STALE",
      `Public sitemap generation ${count.locale}/${count.syncedAt} is older than the committed generation.`
    );
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
    count.pageCount === expectedPageCount &&
    Number.isSafeInteger(count.syncedAt) &&
    count.syncedAt > 0;

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
  const pathsAreSorted = page.paths.every((path, index) => {
    if (path.length === 0) {
      return false;
    }

    const previous = page.paths[index - 1];
    return previous === undefined || compareSitemapPaths(previous, path) < 0;
  });
  const valid =
    Number.isSafeInteger(page.page) &&
    page.page >= 0 &&
    Number.isSafeInteger(page.syncedAt) &&
    page.syncedAt > 0 &&
    page.paths.length >= 1 &&
    page.paths.length <= PUBLIC_SITEMAP_PAGE_SIZE &&
    pathsAreSorted &&
    getDocumentSize(page) < maximumSitemapPageDocumentBytes;

  if (valid) {
    return Effect.void;
  }

  return invalidPage("Public sitemap page paths or size are invalid.");
}

/** Creates the typed invalid-page failure used by artifact mutations. */
function invalidPage(message: string) {
  return sitemapArtifactError("PUBLIC_SITEMAP_PAGE_INVALID", message);
}

/** Creates one typed sitemap artifact failure. */
function sitemapArtifactError(
  code:
    | "PUBLIC_SITEMAP_GENERATION_COLLISION"
    | "PUBLIC_SITEMAP_GENERATION_STALE"
    | "PUBLIC_SITEMAP_PAGE_INVALID",
  message: string
) {
  return Effect.fail(
    new PublicSitemapArtifactError({
      code,
      message,
    })
  );
}

/** Checks whether one immutable page already contains the same exact paths. */
function isSamePage(
  existing: PublicRouteSitemapPage | null,
  next: PublicRouteSitemapPage
) {
  if (!existing) {
    return false;
  }

  return (
    existing.paths.length === next.paths.length &&
    existing.paths.every((path, index) => path === next.paths[index])
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
    existing.pageCount === next.pageCount &&
    existing.syncedAt === next.syncedAt
  );
}
