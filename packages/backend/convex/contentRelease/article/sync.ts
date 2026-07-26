import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
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
import { progressValidator } from "@repo/backend/convex/contentRelease/spec";
import { loadSyncRelease } from "@repo/backend/convex/contentRelease/sync";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

type ModelProgress = Infer<typeof progressValidator>;

const resumeReference = makeFunctionReference<
  "mutation",
  { releaseId: string },
  ModelProgress
>("contentRelease/article/sync:resume");

/** Synchronizes one changed identity into the active article read model. */
const syncArticleItem = Effect.fn("contentRelease.syncArticleItem")(function* (
  ctx: MutationCtx,
  row: Doc<"contentItems">,
  activeSequence: number
) {
  const resolved = yield* resolvePublicProjection(
    ctx,
    row.contentKey,
    row.locale,
    activeSequence
  );
  if (resolved?.family !== "article") {
    return yield* deleteArticle(ctx, row.contentKey, row.locale);
  }
  const [head, projection] = yield* Effect.all([
    loadVersion(ctx, row.contentKey, row.locale, activeSequence),
    decodeProjectionJson(resolved.projectionJson),
  ]);
  if (
    head?.operation !== "upsert" ||
    projection.kind !== "article" ||
    head.projectionJson !== resolved.projectionJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active article head ${row.contentKey}/${row.locale} is incomplete.`
    );
  }
  yield* writeArticle(ctx, head, projection);
});

/** Advances the active article model through one durable release page. */
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
  const afterIndex = release.articleIndex ?? -1;
  const page = yield* loadReleaseItems(ctx, releaseId, afterIndex);
  for (const [offset, row] of page.page.entries()) {
    if (row.index !== afterIndex + offset + 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article sync ${releaseId} lost contiguous item ${afterIndex + offset + 1}.`
      );
    }
    yield* syncArticleItem(ctx, row, release.sequence);
  }
  const nextIndex = page.page.at(-1)?.index ?? afterIndex;
  const done = page.isDone;
  if (done && nextIndex !== signed.manifest.itemCount - 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article sync ${releaseId} stopped at item ${nextIndex}.`
    );
  }
  const now = Date.now();
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      articleIndex: nextIndex,
      ...(done ? { articleSyncedAt: now } : {}),
      updatedAt: now,
    })
  );
  if (done) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, {
        articleManifestHash: signed.manifestHash,
        articleReleaseId: releaseId,
        articleSequence: release.sequence,
        updatedAt: now,
      })
    );
  }
  return { done, nextIndex, processed: page.page.length };
});

/** Runs one bounded article-model page for the authenticated lifecycle action. */
export const page = internalMutation({
  args: { releaseId: v.string() },
  returns: progressValidator,
  handler: (ctx, { releaseId }) =>
    runConvexProgram(syncArticles(ctx, releaseId)),
});

/** Durably resumes article indexing until the active release is complete. */
export const resume = internalMutation({
  args: { releaseId: v.string() },
  returns: progressValidator,
  handler: (ctx, { releaseId }) =>
    runConvexProgram(
      Effect.gen(function* () {
        const result = yield* syncArticles(ctx, releaseId);
        if (!result.done) {
          yield* Effect.promise(() =>
            ctx.scheduler.runAfter(0, resumeReference, { releaseId })
          );
        }
        return result;
      })
    ),
});
