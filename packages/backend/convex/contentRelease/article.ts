import { canonicalizeArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import { isArticleProjection } from "@nakafa/aksara-contracts/projection/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import { contentHead } from "@repo/backend/convex/contentRelease/catalog";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRouteBinding,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { localeValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

const ARTICLE_PAGE_LIMIT = 100;

const articleItemValidator = v.object({
  projectionJson: v.string(),
  sourcePath: v.string(),
});

const articlePageValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  done: v.boolean(),
  items: v.array(articleItemValidator),
  nextCursor: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
});

type ContentLocale = Infer<typeof localeValidator>;

/** Requires one active article path to retain exactly one permanent identity. */
const requireArticlePath = Effect.fn("contentRelease.requireArticlePath")(
  function* (
    ctx: QueryCtx,
    locale: ContentLocale,
    publicPath: string,
    activeSequence: number
  ) {
    const paths = yield* Effect.promise(() =>
      ctx.db
        .query("contentPaths")
        .withIndex("by_locale_and_publicPath", (index) =>
          index.eq("locale", locale).eq("publicPath", publicPath)
        )
        .take(2)
    );
    if (paths.length !== 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Article route ${locale}/${publicPath} lost its active ownership.`
      );
    }
    if (paths[0].createdSequence > activeSequence) {
      return yield* releaseFail(
        "CONTENT_RELEASE_ROUTE",
        `Article route ${locale}/${publicPath} is not active yet.`
      );
    }
  }
);

/** Returns immutable Git provenance only for a normal source release. */
function readSourceRevision(
  active: NonNullable<
    Effect.Effect.Success<ReturnType<typeof loadActiveIdentity>>
  >
) {
  const { origin } = active.signed.manifest;
  return origin.kind === "git" ? origin.sha : null;
}

/** Verifies one active article version and its canonical public binding. */
const readArticleItem = Effect.fn("contentRelease.readArticleItem")(function* (
  ctx: QueryCtx,
  key: Doc<"contentKeys">,
  active: NonNullable<
    Effect.Effect.Success<ReturnType<typeof loadActiveIdentity>>
  >
) {
  const head = yield* loadVersion(
    ctx,
    key.contentKey,
    key.locale,
    active.sequence
  );
  if (!head || head.operation === "delete") {
    return null;
  }
  if (head.family !== "article" || head.delivery !== "public") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article ${key.contentKey}/${key.locale} has an invalid public version.`
    );
  }
  if (!head.projectionJson) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article ${key.contentKey}/${key.locale} lost its projection.`
    );
  }
  const verifiedHead = yield* contentHead(head);

  const projection = yield* decodeProjectionJson(head.projectionJson);
  if (!isArticleProjection(projection)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article ${key.contentKey}/${key.locale} has a non-article projection.`
    );
  }
  const projectionHash = yield* hashText(
    "the active article projection",
    canonicalizeArticleProjection(projection)
  );
  if (
    projectionHash !== head.projectionHash ||
    projection.contentKey !== key.contentKey ||
    projection.locale !== key.locale
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article ${key.contentKey}/${key.locale} has mismatched projection data.`
    );
  }

  yield* requireArticlePath(
    ctx,
    key.locale,
    projection.publicPath,
    active.sequence
  );
  const binding = yield* loadRouteBinding(
    ctx,
    key.locale,
    projection.publicPath,
    active.sequence
  );
  if (binding?.operation !== "bind" || binding.contentKey !== key.contentKey) {
    return yield* releaseFail(
      "CONTENT_RELEASE_ROUTE",
      `Article ${key.contentKey}/${key.locale} lost its canonical route.`
    );
  }
  if (
    binding.sequence === head.sequence &&
    binding.releaseId !== head.releaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article ${key.contentKey}/${key.locale} disagrees at one sequence.`
    );
  }

  return {
    projectionJson: head.projectionJson,
    sourcePath: verifiedHead.sourcePath,
  };
});

/** Reads one bounded article catalog page from the active release snapshot. */
const readArticlePage = Effect.fn("contentRelease.readArticlePage")(function* (
  ctx: QueryCtx,
  locale: ContentLocale,
  cursor: null | string
) {
  const active = yield* loadActiveIdentity(ctx);
  if (!active) {
    return {
      activeReleaseId: null,
      done: true,
      items: [],
      nextCursor: null,
      sourceRevision: null,
    };
  }

  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentKeys")
      .withIndex(
        "by_family_and_locale_and_createdSequence_and_contentKey",
        (index) =>
          index
            .eq("family", "article")
            .eq("locale", locale)
            .lte("createdSequence", active.sequence)
      )
      .order("asc")
      .paginate({
        cursor,
        maximumRowsRead: ARTICLE_PAGE_LIMIT,
        numItems: ARTICLE_PAGE_LIMIT,
      })
  );
  const items: {
    readonly projectionJson: string;
    readonly sourcePath: string;
  }[] = [];
  for (const key of stored.page) {
    const item = yield* readArticleItem(ctx, key, active);
    if (item) {
      items.push(item);
    }
  }

  return {
    activeReleaseId: active.releaseId,
    done: stored.isDone,
    items,
    nextCursor: stored.isDone ? null : stored.continueCursor,
    sourceRevision: readSourceRevision(active),
  };
});

/** Returns one active, bounded article catalog page without artifact bodies. */
export const page = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    locale: localeValidator,
  },
  returns: articlePageValidator,
  handler: (ctx, args) =>
    runConvexProgram(readArticlePage(ctx, args.locale, args.cursor)),
});
