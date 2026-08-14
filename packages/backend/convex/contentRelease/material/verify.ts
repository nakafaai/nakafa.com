import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

type MaterialRow = Doc<"materialCatalog">;

/** Authenticates one self-contained active material read-model row. */
export const verifyMaterial = Effect.fn("contentRelease.verifyMaterial")(
  function* (row: MaterialRow) {
    const projection = yield* decodeProjectionJson(row.projectionJson);
    if (projection.kind !== "subject-lesson") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Active material ${row.contentKey}/${row.appLocale} has a non-material projection.`
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
  }
);
