import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadModelItems } from "@repo/backend/confect/contentRelease/models/items";
import type { ModelBuildPage } from "@repo/backend/confect/contentRelease/models/spec";
import {
  decodeArtifactJson,
  decodeItemJson,
} from "@repo/backend/confect/contentRelease/parse";
import { isSearchFamily } from "@repo/backend/confect/contentRelease/search/spec";
import {
  deleteSearchEntry,
  writeSearchEntry,
} from "@repo/backend/confect/contentRelease/search/write";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import { Effect } from "effect";

type ModelBuild = Docs["contentModelBuilds"];

/** Loads the signed artifact selected by one candidate public projection. */
const loadSearchArtifact = Effect.fn("contentRelease.loadSearchArtifact")(
  function* (
    head: Pick<Docs["contentHeads"], "contentKey" | "artifactLocale">,
    artifactHash: string
  ) {
    const database = yield* DatabaseReader;
    const row = yield* database
      .table("contentArtifacts")
      .get("by_artifactHash", artifactHash)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
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
  build: ModelBuild,
  row: Docs["contentItems"]
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
  ).pipe(Effect.provide(publicationLayer));
  if (!projection) {
    return yield* deleteSearchEntry(
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
    projection,
    projection.artifactHash
  );
  yield* writeSearchEntry(
    build.slots.searchTargetSlot,
    {
      ...projection,
      operation: "upsert",
      delivery: "public",
    },
    projection.projection,
    artifact.payload.plainText
  );
});

/** Applies one bounded release page to the inactive search buffer. */
export const syncSearch = Effect.fn("contentRelease.syncSearch")(function* (
  build: ModelBuild,
  release: Docs["contentReleases"],
  signed: SignedContentRelease
) {
  const page = yield* loadModelItems(release, signed, build.itemIndex);
  for (const row of page.rows) {
    yield* syncSearchItem(build, row);
  }
  return {
    done: page.done,
    itemIndex: page.nextIndex,
    processed: page.rows.length,
  } satisfies ModelBuildPage;
});
