import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadModelItems } from "@repo/backend/convex/contentRelease/models/items";
import type { ModelBuildPage } from "@repo/backend/convex/contentRelease/models/spec";
import {
  decodeArtifactJson,
  decodeItemJson,
} from "@repo/backend/convex/contentRelease/parse";
import { isSearchFamily } from "@repo/backend/convex/contentRelease/search/spec";
import {
  deleteSearchEntry,
  writeSearchEntry,
} from "@repo/backend/convex/contentRelease/search/write";
import { Effect } from "effect";

type ModelBuild = Doc<"contentModelBuilds">;

/** Loads the signed artifact selected by one candidate public projection. */
const loadSearchArtifact = Effect.fn("contentRelease.loadSearchArtifact")(
  function* (
    ctx: MutationCtx,
    head: Pick<Doc<"contentHeads">, "contentKey" | "artifactLocale">,
    artifactHash: string
  ) {
    const row = yield* Effect.promise(() =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (index) =>
          index.eq("artifactHash", artifactHash)
        )
        .unique()
    );
    if (!row) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Search artifact ${artifactHash} does not exist.`
      );
    }
    const artifact = yield* decodeArtifactJson(row.artifactJson);
    if (
      artifact.artifactHash !== artifactHash ||
      artifact.payload.contentKey !== head.contentKey ||
      artifact.payload.artifactLocale !== head.artifactLocale
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Search artifact ${artifactHash} changed identity.`
      );
    }
    return artifact;
  }
);

/** Applies one release identity to the inactive search buffer. */
const syncSearchItem = Effect.fn("contentRelease.syncSearchItem")(function* (
  ctx: MutationCtx,
  build: ModelBuild,
  row: Doc<"contentItems">
) {
  const item = yield* decodeItemJson(row.itemJson);
  if (
    item.change.contentKey !== row.contentKey ||
    item.change.artifactLocale !== row.artifactLocale
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Search item ${row.releaseId}/${row.index} lost its signed identity.`
    );
  }
  if (!isSearchFamily(item.change.family)) {
    return;
  }
  const projection = yield* resolvePublicProjection(
    row.contentKey,
    row.artifactLocale,
    build.sequence
  ).pipe(Effect.provide(convexPublicationLayer(ctx)));
  if (!projection) {
    return yield* deleteSearchEntry(
      ctx,
      build.slots.searchTargetSlot,
      row.contentKey,
      row.artifactLocale
    );
  }
  if (!projection.artifactHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Search head ${row.contentKey}/${row.artifactLocale} is incomplete.`
    );
  }
  const artifact = yield* loadSearchArtifact(
    ctx,
    projection,
    projection.artifactHash
  );
  yield* writeSearchEntry(
    ctx,
    build.slots.searchTargetSlot,
    { ...projection, operation: "upsert", delivery: "public" },
    projection.projection,
    artifact.payload.plainText
  );
});

/** Applies one bounded release page to the inactive search buffer. */
export const syncSearch = Effect.fn("contentRelease.syncSearch")(function* (
  ctx: MutationCtx,
  build: ModelBuild,
  release: Doc<"contentReleases">,
  signed: SignedContentRelease
) {
  const page = yield* loadModelItems(ctx, release, signed, build.itemIndex);
  for (const row of page.rows) {
    yield* syncSearchItem(ctx, build, row);
  }
  return {
    done: page.done,
    itemIndex: page.nextIndex,
    processed: page.rows.length,
  } satisfies ModelBuildPage;
});
