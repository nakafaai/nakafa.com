import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { adjustMaterialBucket } from "@repo/backend/convex/contentRelease/material/bucket";
import {
  countMaterialBucket,
  MATERIAL_MIGRATION_LIMIT,
  type MigrationBucketCount,
  verifyMaterialBuckets,
} from "@repo/backend/convex/contentRelease/material/migration/buckets";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { Effect } from "effect";

type MaterialRow = Doc<"materialCatalog">;

interface MaterialFields {
  readonly assetId: string;
  readonly bucket: string;
  readonly date: string;
}

/** Checks whether all additive catalog fields are absent before migration. */
function hasNoMaterialFields(row: MaterialRow) {
  return (
    row.assetId === undefined &&
    row.bucket === undefined &&
    row.date === undefined
  );
}

/** Checks whether every additive catalog field is already populated. */
function hasAllMaterialFields(row: MaterialRow) {
  return (
    row.assetId !== undefined &&
    row.bucket !== undefined &&
    row.date !== undefined
  );
}

/** Derives additive catalog fields from one authenticated active projection. */
const deriveMaterialFields = Effect.fn("contentRelease.deriveMaterialFields")(
  function* (row: MaterialRow) {
    const bucket = getHashBucket(row.projectionHash);
    if (!bucket) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material ${row.contentKey}/${row.locale} has an invalid projection hash.`
      );
    }
    const { projection } = yield* verifyMaterial(row);
    return {
      assetId: projection.graph.assetId,
      bucket,
      date: projection.metadata.date,
    } satisfies MaterialFields;
  }
);

/** Verifies one populated row still equals its authenticated projection. */
function hasExpectedMaterialFields(row: MaterialRow, fields: MaterialFields) {
  return (
    row.assetId === fields.assetId &&
    row.bucket === fields.bucket &&
    row.date === fields.date
  );
}

/**
 * Audits or migrates the bounded pre-cutover material catalog from its signed
 * projection rows.
 */
export const migrateMaterialCatalog = Effect.fn(
  "contentRelease.migrateMaterialCatalog"
)(function* (
  ctx: MutationCtx,
  input: { readonly apply: boolean; readonly expectedMissing: number }
) {
  if (
    !Number.isInteger(input.expectedMissing) ||
    input.expectedMissing < 0 ||
    input.expectedMissing > MATERIAL_MIGRATION_LIMIT
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material migration expects between 0 and ${MATERIAL_MIGRATION_LIMIT} missing rows.`
    );
  }
  const rows = yield* Effect.promise(() =>
    ctx.db.query("materialCatalog").take(MATERIAL_MIGRATION_LIMIT + 1)
  );
  if (rows.length > MATERIAL_MIGRATION_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material migration exceeds ${MATERIAL_MIGRATION_LIMIT} catalog rows.`
    );
  }

  const candidates: Array<{
    readonly fields: MaterialFields;
    readonly row: MaterialRow;
  }> = [];
  const expectedBuckets = new Map<string, MigrationBucketCount>();
  for (const row of rows) {
    const fields = yield* deriveMaterialFields(row);
    if (hasNoMaterialFields(row)) {
      candidates.push({ fields, row });
      continue;
    }
    if (
      !(hasAllMaterialFields(row) && hasExpectedMaterialFields(row, fields))
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material ${row.contentKey}/${row.locale} has partial or invalid catalog fields.`
      );
    }
    countMaterialBucket(expectedBuckets, row.locale, fields.bucket);
  }

  if (candidates.length !== input.expectedMissing) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Material migration found ${candidates.length} missing rows instead of ${input.expectedMissing}.`
    );
  }
  if (input.apply) {
    for (const { fields, row } of candidates) {
      yield* ensureDocumentSize(
        "Migrated material catalog entry",
        { ...row, ...fields },
        READ_MODEL_DOCUMENT_LIMIT
      );
      yield* adjustMaterialBucket(ctx, row.locale, fields.bucket, 1);
      yield* Effect.promise(() =>
        ctx.db.patch("materialCatalog", row._id, fields)
      );
      countMaterialBucket(expectedBuckets, row.locale, fields.bucket);
    }
  }
  yield* verifyMaterialBuckets(ctx, expectedBuckets);
  return {
    candidates: candidates.length,
    updated: input.apply ? candidates.length : 0,
  };
});
