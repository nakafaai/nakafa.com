import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import {
  decodeCategory,
  verifyArticle,
  verifyCategory,
} from "@repo/backend/convex/contentRelease/article/verify";
import {
  hasStaleReleaseCursor,
  validateReleaseCursor,
} from "@repo/backend/convex/contentRelease/cursor";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { validateProjectionPage } from "@repo/backend/convex/contentRelease/paging";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { Effect } from "effect";

/** Returns a stable empty page when Aksara does not own articles yet. */
function emptyPage() {
  return {
    continueCursor: "",
    isDone: true,
    page: [],
  };
}

/** Reads newest active articles from one exact category index. */
export const readArticlePage = Effect.fn("contentRelease.readArticlePage")(
  function* (
    ctx: QueryCtx,
    categorySource: string,
    locale: Doc<"articleCatalog">["locale"],
    expectedManifestHash: null | string,
    expectedReleaseId: null | string,
    paginationOpts: Parameters<typeof validateProjectionPage>[0]
  ) {
    const [category, options, owner] = yield* Effect.all([
      decodeCategory(categorySource),
      validateProjectionPage(paginationOpts),
      loadArticleOwner(ctx, locale),
    ]);
    if (options.endCursor !== undefined && options.endCursor !== null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        "Article pages accept only their server-owned continuation cursor."
      );
    }
    const active = owner.managed && owner.active ? owner.active : null;
    if (
      hasStaleReleaseCursor(
        options.cursor,
        expectedManifestHash,
        expectedReleaseId,
        active
      )
    ) {
      return {
        activeManifestHash: active?.manifestHash ?? null,
        activeReleaseId: active?.releaseId ?? null,
        managed: owner.managed,
        result: emptyPage(),
        sourceRevision: active ? readSourceRevision(active) : null,
        stale: true,
      };
    }
    yield* validateReleaseCursor(
      options.cursor,
      expectedManifestHash,
      expectedReleaseId,
      active
    );
    if (!(owner.managed && owner.active)) {
      return {
        activeManifestHash: owner.active?.manifestHash ?? null,
        activeReleaseId: owner.active?.releaseId ?? null,
        managed: false,
        result: emptyPage(),
        sourceRevision: null,
        stale: false,
      };
    }
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("articleCatalog")
        .withIndex("by_locale_and_category_and_date_and_contentKey", (index) =>
          index.eq("locale", locale).eq("category", category)
        )
        .order("desc")
        .paginate(options)
    );
    const page = yield* Effect.forEach(stored.page, (row) =>
      verifyArticle(ctx, row, owner.active.sequence).pipe(
        Effect.map(({ resolved }) => resolved)
      )
    );
    return {
      activeManifestHash: owner.active.manifestHash,
      activeReleaseId: owner.active.releaseId,
      managed: true,
      result: { ...stored, page },
      sourceRevision: readSourceRevision(owner.active),
      stale: false,
    };
  }
);

/** Reads active categories from their dedicated bounded category index. */
export const readCategoryPage = Effect.fn(
  "contentRelease.readArticleCategories"
)(function* (
  ctx: QueryCtx,
  locale: Doc<"articleCategories">["locale"],
  expectedManifestHash: null | string,
  expectedReleaseId: null | string,
  paginationOpts: Parameters<typeof validateProjectionPage>[0]
) {
  const [options, owner] = yield* Effect.all([
    validateProjectionPage(paginationOpts),
    loadArticleOwner(ctx, locale),
  ]);
  if (options.endCursor !== undefined && options.endCursor !== null) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      "Category pages accept only their server-owned continuation cursor."
    );
  }
  const active = owner.managed && owner.active ? owner.active : null;
  if (
    hasStaleReleaseCursor(
      options.cursor,
      expectedManifestHash,
      expectedReleaseId,
      active
    )
  ) {
    return {
      activeManifestHash: active?.manifestHash ?? null,
      activeReleaseId: active?.releaseId ?? null,
      managed: owner.managed,
      result: emptyPage(),
      sourceRevision: active ? readSourceRevision(active) : null,
      stale: true,
    };
  }
  yield* validateReleaseCursor(
    options.cursor,
    expectedManifestHash,
    expectedReleaseId,
    active
  );
  if (!(owner.managed && owner.active)) {
    return {
      activeManifestHash: owner.active?.manifestHash ?? null,
      activeReleaseId: owner.active?.releaseId ?? null,
      managed: false,
      result: emptyPage(),
      sourceRevision: null,
      stale: false,
    };
  }
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("articleCategories")
      .withIndex("by_locale_and_category", (index) =>
        index.eq("locale", locale)
      )
      .paginate(options)
  );
  const page = yield* Effect.forEach(stored.page, (category) =>
    verifyCategory(ctx, category, owner.active.sequence)
  );
  return {
    activeManifestHash: owner.active.manifestHash,
    activeReleaseId: owner.active.releaseId,
    managed: true,
    result: { ...stored, page },
    sourceRevision: readSourceRevision(owner.active),
    stale: false,
  };
});
