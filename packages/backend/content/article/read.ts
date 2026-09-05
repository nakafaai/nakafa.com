import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { ArticleSource } from "@repo/backend/content/article/source";
import {
  decodeCategory,
  verifyArticle,
  verifyCategory,
} from "@repo/backend/content/article/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import {
  decodePageCursor,
  encodePageCursor,
  hasPageCursorPrefix,
  hasStaleReleaseCursor,
  validateReleaseCursor,
} from "@repo/backend/convex/contentRelease/cursor";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  validateProjectionPage,
  validatePublicationPage,
} from "@repo/backend/convex/contentRelease/paging";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { hasArticlePublicationCursorPrefix } from "@repo/contents/_types/publication";
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
    categorySource: string,
    appLocale: PublicationRow<"articleCatalog">["appLocale"],
    expectedManifestHash: null | string,
    expectedReleaseId: null | string,
    paginationOpts: Parameters<typeof validatePublicationPage>[0]
  ) {
    const [category, options, owner] = yield* Effect.all([
      decodeCategory(categorySource),
      validatePublicationPage(paginationOpts),
      loadArticleOwner(appLocale),
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
      ) ||
      (options.cursor !== null &&
        !hasArticlePublicationCursorPrefix(options.cursor))
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
    if (!(owner.managed && owner.active && owner.slot)) {
      return {
        activeManifestHash: owner.active?.manifestHash ?? null,
        activeReleaseId: owner.active?.releaseId ?? null,
        managed: false,
        result: emptyPage(),
        sourceRevision: null,
        stale: false,
      };
    }
    const source = yield* ArticleSource;
    const stored = yield* source.publications(
      owner.slot,
      appLocale,
      category,
      options
    );
    const page = yield* Effect.forEach(stored.page, (row) =>
      verifyArticle(row, owner.active.sequence).pipe(
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
  appLocale: PublicationRow<"articleCategories">["appLocale"],
  expectedManifestHash: null | string,
  expectedReleaseId: null | string,
  paginationOpts: Parameters<typeof validateProjectionPage>[0]
) {
  const [options, owner] = yield* Effect.all([
    validateProjectionPage(paginationOpts),
    loadArticleOwner(appLocale),
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
    ) ||
    !hasPageCursorPrefix(options.cursor)
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
  if (!(owner.managed && owner.active && owner.slot)) {
    return {
      activeManifestHash: owner.active?.manifestHash ?? null,
      activeReleaseId: owner.active?.releaseId ?? null,
      managed: false,
      result: emptyPage(),
      sourceRevision: null,
      stale: false,
    };
  }
  const nativeCursor = yield* decodePageCursor(
    options.cursor,
    "category",
    owner.slot
  );
  const source = yield* ArticleSource;
  const stored = yield* source.categories(owner.slot, appLocale, {
    ...options,
    cursor: nativeCursor,
  });
  const page = yield* Effect.forEach(stored.page, (category) =>
    verifyCategory(category, owner.active.sequence)
  );
  return {
    activeManifestHash: owner.active.manifestHash,
    activeReleaseId: owner.active.releaseId,
    managed: true,
    result: {
      ...stored,
      continueCursor: encodePageCursor(
        "category",
        owner.slot,
        stored.continueCursor
      ),
      page,
      ...(stored.splitCursor === undefined || stored.splitCursor === null
        ? {}
        : {
            splitCursor: encodePageCursor(
              "category",
              owner.slot,
              stored.splitCursor
            ),
          }),
    },
    sourceRevision: readSourceRevision(owner.active),
    stale: false,
  };
});
