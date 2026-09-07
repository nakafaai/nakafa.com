import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type MaterialRow = WithoutSystemFields<Doc<"materialCatalog">>;

/** Checks all catalog fields against one authenticated material projection. */
const verifyMaterialMetadata = Effect.fn(
  "contentRelease.verifyMaterialMetadata"
)(function* (
  row: MaterialRow,
  projection: Extract<
    Effect.Success<ReturnType<typeof decodeProjectionJson>>,
    { kind: "subject-lesson" }
  >,
  projectionHash: string
) {
  const projectionJson = canonicalizeMaterialProjection(projection);
  if (
    projectionJson !== row.projectionJson ||
    projectionHash !== row.projectionHash ||
    getHashBucket(projectionHash) !== row.bucket ||
    projection.graph.assetId !== row.assetId ||
    projection.metadata.dateModified !== row.dateModified ||
    projection.metadata.datePublished !== row.datePublished ||
    projection.contentKey !== row.contentKey ||
    projection.appLocale !== row.appLocale ||
    projection.materialKey !== row.materialKey ||
    projection.order !== row.order ||
    projection.parentPath !== row.parentPath ||
    projection.publicPath !== row.publicPath
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active material ${row.contentKey}/${row.appLocale} changed catalog metadata.`
    );
  }
  return { projection, projectionJson };
});

/** Authenticates a standalone catalog row before comparing its metadata. */
export const verifyMaterial = Effect.fn("contentRelease.verifyMaterial")(
  function* (row: MaterialRow) {
    const projection = yield* decodeProjectionJson(row.projectionJson);
    if (projection.kind !== "subject-lesson") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active material ${row.contentKey}/${row.appLocale} has a non-material projection.`
      );
    }
    const projectionHash = yield* hashText(
      "the active material projection",
      canonicalizeMaterialProjection(projection)
    );
    return yield* verifyMaterialMetadata(row, projection, projectionHash);
  }
);

/** Reuses authenticated publication bytes while retaining every catalog invariant. */
export const verifyMaterialProjection = Effect.fn(
  "contentRelease.verifyMaterialProjection"
)(function* (
  row: MaterialRow,
  resolved: Effect.Success<ReturnType<typeof resolvePublicProjection>>
) {
  if (
    resolved?.projection.kind !== "subject-lesson" ||
    resolved.projectionHash !== row.projectionHash ||
    resolved.projectionJson !== row.projectionJson ||
    resolved.publicPath !== row.publicPath ||
    resolved.releaseId !== row.releaseId ||
    resolved.rendererDomain !== row.rendererDomain ||
    resolved.sequence !== row.sequence ||
    resolved.sourcePath !== row.sourcePath
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active material ${row.contentKey}/${row.appLocale} disagrees with its effective publication.`
    );
  }
  const verified = yield* verifyMaterialMetadata(
    row,
    resolved.projection,
    resolved.projectionHash
  );
  return { ...verified, resolved };
});

/** Authenticates one material row against its effective active publication. */
export const verifyEffectiveMaterial = Effect.fn(
  "contentRelease.verifyEffectiveMaterial"
)(function* (row: MaterialRow, activeSequence: number) {
  const resolved = yield* resolvePublicProjection(
    row.contentKey,
    ArtifactLocaleSchema.make(row.appLocale),
    activeSequence
  );
  return yield* verifyMaterialProjection(row, resolved);
});
