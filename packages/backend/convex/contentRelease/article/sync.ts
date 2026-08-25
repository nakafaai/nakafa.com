import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { validateArticleModel } from "@repo/backend/convex/contentRelease/article/validation";
import {
  deleteArticle,
  writeArticle,
} from "@repo/backend/convex/contentRelease/article/write";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadReleaseItems,
  loadVersion,
} from "@repo/backend/convex/contentRelease/model";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { loadSyncRelease } from "@repo/backend/convex/contentRelease/sync";
import { Effect } from "effect";

/** Resolves one changed identity against the effective active release. */
const resolveArticleChange = Effect.fn("contentRelease.resolveArticleChange")(
  function* (
    ctx: MutationCtx,
    row: Doc<"contentItems">,
    activeSequence: number
  ) {
    const resolved = yield* resolvePublicProjection(
      ctx,
      row.contentKey,
      row.artifactLocale,
      activeSequence
    );
    if (resolved?.family !== "article") {
      return null;
    }
    const projection = yield* decodeProjectionJson(resolved.projectionJson);
    if (projection.kind !== "article") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active article ${row.contentKey}/${row.artifactLocale} has a non-article projection.`
      );
    }
    return { projection, resolved };
  }
);

/** Synchronizes one changed identity into the active article read model. */
const syncArticleItem = Effect.fn("contentRelease.syncArticleItem")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">,
  activeSequence: number
) {
  const change = yield* resolveArticleChange(ctx, row, activeSequence);
  if (!change) {
    return yield* deleteArticle(ctx, row.contentKey, row.artifactLocale);
  }
  const head = yield* loadVersion(
    ctx,
    row.contentKey,
    row.artifactLocale,
    activeSequence
  );
  if (
    head?.operation !== "upsert" ||
    head.projectionJson !== change.resolved.projectionJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active article head ${row.contentKey}/${row.artifactLocale} is incomplete.`
    );
  }
  yield* writeArticle(ctx, head, change.projection);
});

/** Requires one release page to preserve its immutable contiguous order. */
const validateReleasePage = Effect.fn(
  "contentRelease.validateArticleReleasePage"
)(function* (
  releaseId: string,
  afterIndex: number,
  rows: Doc<"contentItems">[]
) {
  for (const [offset, row] of rows.entries()) {
    if (row.index !== afterIndex + offset + 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article sync ${releaseId} lost contiguous item ${afterIndex + offset + 1}.`
      );
    }
  }
});

/** Stages one bounded page without publishing incomplete article ownership. */
const stageArticlePage = Effect.fn("contentRelease.stageArticlePage")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    activeSequence: number,
    afterIndex: number,
    completedIndex: number
  ) {
    const page = yield* loadReleaseItems(ctx, releaseId, afterIndex);
    yield* validateReleasePage(releaseId, afterIndex, page.page);
    for (const row of page.page) {
      yield* syncArticleItem(ctx, row, activeSequence);
    }
    const nextIndex = page.page.at(-1)?.index ?? afterIndex;
    if (page.isDone && nextIndex !== completedIndex) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article sync ${releaseId} stopped at item ${nextIndex}.`
      );
    }
    return { nextIndex, processed: page.page.length };
  }
);

/** Rejects release items beyond the immutable signed manifest count. */
const validateReleaseTail = Effect.fn(
  "contentRelease.validateArticleReleaseTail"
)(function* (ctx: MutationCtx, releaseId: string, completedIndex: number) {
  const remainder = yield* Effect.promise(() =>
    ctx.db
      .query("contentItems")
      .withIndex("by_releaseId_and_index", (index) =>
        index.eq("releaseId", releaseId).gt("index", completedIndex)
      )
      .first()
  );
  if (remainder) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article sync ${releaseId} contains items beyond ${completedIndex}.`
    );
  }
});

/** Advances staging and final-model validation through durable bounded pages. */
export const syncArticles = Effect.fn("contentRelease.syncArticles")(function* (
  ctx: MutationCtx,
  releaseId: string
) {
  const { release, signed, state } = yield* loadSyncRelease(ctx, releaseId);
  if (
    state.articleManifestHash === signed.manifestHash &&
    state.articleReleaseId === releaseId &&
    state.articleSequence === release.sequence
  ) {
    return {
      done: true,
      nextIndex: release.articleIndex ?? signed.manifest.itemCount - 1,
      processed: 0,
    };
  }
  const completedIndex = signed.manifest.itemCount - 1;
  const articleIndex = release.articleIndex ?? -1;
  if (articleIndex > completedIndex) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article sync ${releaseId} advanced beyond item ${completedIndex}.`
    );
  }
  if (articleIndex < completedIndex) {
    const progress = yield* stageArticlePage(
      ctx,
      releaseId,
      release.sequence,
      articleIndex,
      completedIndex
    );
    const now = Date.now();
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        articleIndex: progress.nextIndex,
        updatedAt: now,
      })
    );
    return { done: false, ...progress };
  }

  if (release.articleCursor === undefined) {
    yield* validateReleaseTail(ctx, releaseId, completedIndex);
  }
  const progress = yield* validateArticleModel(ctx, release.articleCursor);
  const now = Date.now();
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      articleCursor: progress.cursor,
      ...(progress.done ? { articleSyncedAt: now } : {}),
      updatedAt: now,
    })
  );
  if (progress.done) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, {
        articleManifestHash: signed.manifestHash,
        articleReleaseId: releaseId,
        articleSequence: release.sequence,
        updatedAt: now,
      })
    );
  }
  return {
    done: progress.done,
    nextIndex: completedIndex,
    processed: progress.processed,
  };
});
