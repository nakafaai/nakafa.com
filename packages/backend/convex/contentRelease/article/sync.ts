import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { validateArticleModel } from "@repo/backend/convex/contentRelease/article/validation";
import {
  deleteArticle,
  writeArticle,
} from "@repo/backend/convex/contentRelease/article/write";
import { loadModelItems } from "@repo/backend/convex/contentRelease/models/items";
import type { ModelBuildPage } from "@repo/backend/convex/contentRelease/models/spec";
import { Effect } from "effect";

type ModelBuild = Doc<"contentModelBuilds">;
type Release = Doc<"contentReleases">;

/** Resolves one changed identity against the effective active release. */
const resolveArticleChange = Effect.fn("contentRelease.resolveArticleChange")(
  function* (
    ctx: MutationCtx,
    row: Doc<"contentItems">,
    activeSequence: number
  ) {
    const resolved = yield* resolvePublicProjection(
      row.contentKey,
      row.artifactLocale,
      activeSequence
    ).pipe(Effect.provide(convexPublicationLayer(ctx)));
    if (resolved?.projection.kind !== "article") {
      return null;
    }
    return { projection: resolved.projection, resolved };
  }
);

/** Synchronizes one changed identity into the active article read model. */
const syncArticleItem = Effect.fn("contentRelease.syncArticleItem")(function* (
  ctx: MutationCtx,
  build: ModelBuild,
  row: Doc<"contentItems">,
  activeSequence: number
) {
  const change = yield* resolveArticleChange(ctx, row, activeSequence);
  if (!change) {
    return yield* deleteArticle(
      ctx,
      build.slots.articleTargetSlot,
      row.contentKey,
      row.artifactLocale
    );
  }
  yield* writeArticle(
    ctx,
    build.slots.articleTargetSlot,
    { ...change.resolved, delivery: "public", operation: "upsert" },
    change.projection
  );
});

/** Advances staging and final-model validation through durable bounded pages. */
export const syncArticles = Effect.fn("contentRelease.syncArticles")(function* (
  ctx: MutationCtx,
  build: ModelBuild,
  release: Release,
  signed: SignedContentRelease
) {
  const page = yield* loadModelItems(ctx, release, signed, build.itemIndex);
  for (const row of page.rows) {
    yield* syncArticleItem(ctx, build, row, release.sequence);
  }
  return {
    done: page.done,
    itemIndex: page.nextIndex,
    processed: page.rows.length,
  } satisfies ModelBuildPage;
});

/** Validates one bounded page of the completed inactive article buffer. */
export const verifyArticleBuild = Effect.fn(
  "contentRelease.verifyArticleBuild"
)(function* (ctx: MutationCtx, build: ModelBuild) {
  return yield* validateArticleModel(
    ctx,
    build.slots.articleTargetSlot,
    build.cursor,
    build.sequence
  );
});
