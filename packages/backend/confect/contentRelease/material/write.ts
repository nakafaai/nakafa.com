import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { getHashBucket } from "@repo/backend/confect/contentRelease/bucket";
import { hashText } from "@repo/backend/confect/contentRelease/digest";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { adjustMaterialBucket } from "@repo/backend/confect/contentRelease/material/bucket";
import { deriveMaterialTopicReference } from "@repo/backend/confect/contentRelease/material/topic";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import type { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import { Effect } from "effect";

type PublicProjection = Pick<
  NonNullable<Effect.Success<ReturnType<typeof resolvePublicProjection>>>,
  | "appLocale"
  | "artifactLocale"
  | "contentKey"
  | "family"
  | "projectionHash"
  | "projectionJson"
  | "publicPath"
  | "releaseId"
  | "rendererDomain"
  | "sequence"
  | "sourcePath"
>;
type AppLocale = Docs["materialCatalog"]["appLocale"];
/** Loads the sole active material row for one localized content identity. */
const loadMaterial = Effect.fn("contentRelease.loadMaterial")(function* (
  slot: ModelSlot,
  contentKey: string,
  appLocale: AppLocale
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("materialCatalog")
    .get("by_slot_and_contentKey_and_appLocale", slot, contentKey, appLocale)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});
/** Replaces one active material lesson with its indexed curriculum facts. */
export const writeMaterial = Effect.fn("contentRelease.writeMaterial")(
  function* (
    slot: ModelSlot,
    head: PublicProjection,
    projection: MaterialLessonProjection
  ) {
    const writer = yield* DatabaseWriter;
    if (
      head.family !== "material" ||
      !head.projectionJson ||
      !head.rendererDomain ||
      !head.sourcePath ||
      projection.contentKey !== head.contentKey ||
      projection.appLocale !== head.appLocale ||
      projection.artifactLocale !== head.artifactLocale ||
      projection.publicPath !== head.publicPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material entry ${head.contentKey}/${head.appLocale} lost its public identity.`
      );
    }
    const projectionJson = canonicalizeMaterialProjection(projection);
    const projectionHash = yield* hashText(
      "the active material projection",
      projectionJson
    );
    if (
      head.projectionHash !== projectionHash ||
      head.projectionJson !== projectionJson
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material entry ${head.contentKey}/${head.appLocale} changed its projection.`
      );
    }
    const bucket = getHashBucket(projectionHash);
    const topic = yield* deriveMaterialTopicReference(projection);
    const row = {
      appLocale: head.appLocale,
      assetId: projection.graph.assetId,
      bucket,
      contentKey: head.contentKey,
      ...(projection.metadata.dateModified === undefined
        ? {}
        : {
            dateModified: projection.metadata.dateModified,
          }),
      datePublished: projection.metadata.datePublished,
      materialKey: projection.materialKey,
      order: projection.order,
      parentPath: projection.parentPath,
      projectionHash,
      projectionJson,
      publicPath: projection.publicPath,
      releaseId: head.releaseId,
      rendererDomain: head.rendererDomain,
      sequence: head.sequence,
      sourcePath: head.sourcePath,
      topicAssetId: topic.graph.assetId,
      slot,
    };
    yield* ensureDocumentSize(
      "Active material catalog entry",
      row,
      READ_MODEL_DOCUMENT_LIMIT
    );
    const existing = yield* loadMaterial(slot, head.contentKey, head.appLocale);
    if (existing) {
      if (existing.bucket !== row.bucket) {
        yield* adjustMaterialBucket(
          slot,
          existing.appLocale,
          existing.bucket,
          -1
        );
        yield* adjustMaterialBucket(slot, row.appLocale, row.bucket, 1);
      }
      yield* writer
        .table("materialCatalog")
        .replace(existing._id, row)
        .pipe(Effect.orDie);
      return;
    }
    yield* adjustMaterialBucket(slot, row.appLocale, row.bucket, 1);
    yield* writer.table("materialCatalog").insert(row).pipe(Effect.orDie);
  }
);
/** Deletes one active localized material row when its head disappears. */
export const deleteMaterial = Effect.fn("contentRelease.deleteMaterial")(
  function* (slot: ModelSlot, contentKey: string, appLocale: AppLocale) {
    const writer = yield* DatabaseWriter;
    const existing = yield* loadMaterial(slot, contentKey, appLocale);
    if (!existing) {
      return;
    }
    yield* adjustMaterialBucket(slot, existing.appLocale, existing.bucket, -1);
    yield* writer.table("materialCatalog").delete(existing._id);
  }
);
