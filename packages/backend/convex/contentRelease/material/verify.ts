import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeProjectionWireJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

type MaterialRow = Doc<"materialCatalog">;

/** Authenticates one self-contained active material read-model row. */
export const verifyMaterial = Effect.fn("contentRelease.verifyMaterial")(
  function* (row: MaterialRow) {
    const projection = yield* decodeProjectionWireJson(row.projectionJson);
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
