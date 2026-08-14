import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

type MaterialRow = Doc<"materialCatalog">;
type ReadCtx = MutationCtx | QueryCtx;

/** Authenticates one self-contained active material read-model row. */
export const verifyMaterial = Effect.fn("contentRelease.verifyMaterial")(
  function* (row: MaterialRow) {
    const projection = yield* decodeProjectionJson(row.projectionJson);
    if (projection.kind !== "subject-lesson") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active material ${row.contentKey}/${row.locale} has a non-material projection.`
      );
    }
    const projectionJson = canonicalizeMaterialProjection(projection);
    const projectionHash = yield* hashText(
      "the active material projection",
      projectionJson
    );
    if (
      projectionJson !== row.projectionJson ||
      projectionHash !== row.projectionHash ||
      getHashBucket(projectionHash) !== row.bucket ||
      projection.graph.assetId !== row.assetId ||
      projection.metadata.date !== row.date ||
      projection.contentKey !== row.contentKey ||
      projection.locale !== row.locale ||
      projection.materialKey !== row.materialKey ||
      projection.order !== row.order ||
      projection.parentPath !== row.parentPath ||
      projection.publicPath !== row.publicPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active material ${row.contentKey}/${row.locale} changed catalog metadata.`
      );
    }
    return { projection, projectionJson };
  }
);

/** Authenticates one material row against its effective active publication. */
export const verifyEffectiveMaterial = Effect.fn(
  "contentRelease.verifyEffectiveMaterial"
)(function* (ctx: ReadCtx, row: MaterialRow, activeSequence: number) {
  const [{ projection, projectionJson }, resolved] = yield* Effect.all([
    verifyMaterial(row),
    resolvePublicProjection(ctx, row.contentKey, row.locale, activeSequence),
  ]);
  if (
    resolved?.family !== "material" ||
    resolved.projectionHash !== row.projectionHash ||
    resolved.projectionJson !== projectionJson ||
    resolved.publicPath !== row.publicPath ||
    resolved.releaseId !== row.releaseId ||
    resolved.rendererDomain !== row.rendererDomain ||
    resolved.sequence !== row.sequence ||
    resolved.sourcePath !== row.sourcePath
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active material ${row.contentKey}/${row.locale} disagrees with its effective publication.`
    );
  }
  return { projection, resolved };
});
