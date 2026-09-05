import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import { verifyMaterial } from "@repo/backend/content/material/verify";
import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import type {
  RuntimeRow,
  RuntimeTables,
} from "@repo/backend/content/snapshot/tables";
import {
  CONTENT_BUCKET_SIZE,
  getHashBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { isSearchFamily } from "@repo/backend/convex/contentRelease/search/spec";
import { Effect } from "effect";

interface PublicProjection {
  readonly head: RuntimeRow<"contentHeads">;
  readonly projection: ContentProjection;
}

const identity = (row: {
  readonly appLocale: string;
  readonly contentKey: string;
}) => JSON.stringify([row.contentKey, row.appLocale]);
const bucketIdentity = (row: {
  readonly appLocale: string;
  readonly bucket: string;
}) => JSON.stringify([row.appLocale, row.bucket]);

/** Verifies complete partition counts without scanning the catalog once per bucket. */
const verifyBuckets = Effect.fn("contentRuntime.verifyCatalogBuckets")(
  function* (
    rows: readonly { readonly appLocale: string; readonly bucket: string }[],
    buckets: readonly {
      readonly appLocale: string;
      readonly bucket: string;
      readonly count: number;
    }[]
  ) {
    const expected = new Map<string, number>();
    for (const row of rows) {
      const key = bucketIdentity(row);
      expected.set(key, (expected.get(key) ?? 0) + 1);
    }
    const seen = new Set<string>();
    for (const bucket of buckets) {
      const key = bucketIdentity(bucket);
      if (
        seen.has(key) ||
        bucket.count > CONTENT_BUCKET_SIZE ||
        bucket.count !== (expected.get(key) ?? 0)
      ) {
        return yield* contentSnapshotError(
          "Signed runtime catalog has duplicate or incomplete partitions."
        );
      }
      seen.add(key);
      expected.delete(key);
    }
    if (expected.size > 0) {
      return yield* contentSnapshotError(
        "Signed runtime catalog lost a partition."
      );
    }
  }
);

/** Validates active catalog coverage and all references to effective public heads. */
export const validateRuntimeCatalogs = Effect.fn(
  "contentRuntime.validateCatalogClosure"
)(function* (
  tables: RuntimeTables,
  projections: readonly PublicProjection[],
  activeSequence: number
) {
  const publicByIdentity = new Map(
    projections.map((entry) => [
      JSON.stringify([entry.head.contentKey, entry.head.artifactLocale]),
      entry,
    ])
  );
  const pages = new Map(
    tables.contentKeys.map((row) => [
      JSON.stringify([row.contentKey, row.artifactLocale]),
      row,
    ])
  );
  const expectedPages = projections.filter(
    ({ head }) => head.family === "page"
  );
  if (
    pages.size !== tables.contentKeys.length ||
    pages.size !== expectedPages.length ||
    tables.contentKeys.some(
      (row) => row.family !== "page" || row.createdSequence > activeSequence
    ) ||
    expectedPages.some(
      ({ head }) =>
        !pages.has(JSON.stringify([head.contentKey, head.artifactLocale]))
    )
  ) {
    return yield* contentSnapshotError(
      "Signed runtime page keys do not match the active public pages."
    );
  }
  for (const [rows, expected] of [
    [
      tables.materialCatalog,
      projections.filter(({ head }) => head.family === "material"),
    ],
    [
      tables.articleCatalog,
      projections.filter(({ head }) => head.family === "article"),
    ],
    [
      tables.contentIndex,
      projections.filter(({ head }) => isSearchFamily(head.family)),
    ],
  ] as const) {
    const seen = new Set<string>();
    for (const row of rows) {
      const key = identity(row);
      const entry = publicByIdentity.get(key);
      if (
        !entry ||
        seen.has(key) ||
        entry.projection.kind === "question-body" ||
        row.projectionHash !== entry.head.projectionHash ||
        row.releaseId !== entry.head.releaseId ||
        row.sequence !== entry.head.sequence ||
        row.publicPath !== entry.projection.publicPath
      ) {
        return yield* contentSnapshotError(
          "Signed runtime catalog lost an effective public head."
        );
      }
      seen.add(key);
    }
    if (
      seen.size !== expected.length ||
      expected.some(
        ({ head }) =>
          !seen.has(JSON.stringify([head.contentKey, head.artifactLocale]))
      )
    ) {
      return yield* contentSnapshotError(
        "Signed runtime catalog does not cover every active public head."
      );
    }
  }
  for (const row of tables.materialCatalog) {
    yield* verifyMaterial(row);
    const head = publicByIdentity.get(identity(row))?.head;
    if (
      row.rendererDomain !== head?.rendererDomain ||
      row.sourcePath !== head?.sourcePath ||
      row.projectionJson !== head?.projectionJson
    ) {
      return yield* contentSnapshotError(
        "Signed runtime material provenance disagrees with its public head."
      );
    }
  }
  const expectedCategories = new Set<string>();
  const articleProjections = new Map<
    string,
    Extract<ContentProjection, { readonly kind: "article" }>
  >();
  for (const row of tables.articleCatalog) {
    const entry = publicByIdentity.get(identity(row));
    const projection = entry?.projection;
    if (
      !entry ||
      projection?.kind !== "article" ||
      projection.graph.assetId !== row.assetId ||
      projection.category !== row.category ||
      projection.categoryTitle !== row.categoryTitle ||
      projection.metadata.dateModified !== row.dateModified ||
      projection.metadata.datePublished !== row.datePublished ||
      getHashBucket(row.projectionHash) !== row.bucket ||
      row.rendererDomain !== entry.head.rendererDomain
    ) {
      return yield* contentSnapshotError(
        "Signed runtime article metadata disagrees with its public head."
      );
    }
    articleProjections.set(identity(row), projection);
    expectedCategories.add(JSON.stringify([row.appLocale, row.category]));
  }
  const seenCategories = new Set<string>();
  for (const row of tables.articleCategories) {
    const key = JSON.stringify([row.appLocale, row.category]);
    const projection = articleProjections.get(identity(row));
    const head = publicByIdentity.get(identity(row))?.head;
    if (
      seenCategories.has(key) ||
      !expectedCategories.has(key) ||
      projection?.category !== row.category ||
      projection.categoryTitle !== row.title ||
      (row.route !== undefined && projection.categoryRouteSlug !== row.route) ||
      row.projectionHash !== head?.projectionHash ||
      row.releaseId !== head?.releaseId ||
      row.sequence !== head?.sequence ||
      row.rendererDomain !== head?.rendererDomain ||
      getHashBucket(row.projectionHash) !== row.bucket
    ) {
      return yield* contentSnapshotError(
        "Signed runtime article category lost its active representative."
      );
    }
    seenCategories.add(key);
  }
  if (seenCategories.size !== expectedCategories.size) {
    return yield* contentSnapshotError(
      "Signed runtime article catalog lost a category."
    );
  }
  if (
    tables.materialBuckets.some((row) => row.count <= 0) ||
    tables.articleBuckets.some(
      (row) =>
        row.articleCount + row.categoryCount <= 0 ||
        row.articleCount + row.categoryCount > CONTENT_BUCKET_SIZE
    ) ||
    tables.programBuckets.some((row) => row.routeCount <= 0)
  ) {
    return yield* contentSnapshotError(
      "Signed runtime contains an empty or oversized catalog partition."
    );
  }
  yield* verifyBuckets(tables.materialCatalog, tables.materialBuckets);
  yield* verifyBuckets(
    tables.articleCatalog,
    tables.articleBuckets.map((row) => ({ ...row, count: row.articleCount }))
  );
  yield* verifyBuckets(
    tables.articleCategories,
    tables.articleBuckets.map((row) => ({ ...row, count: row.categoryCount }))
  );
  yield* verifyBuckets(
    tables.curriculumRoutes.flatMap((row) =>
      row.bucket === undefined
        ? []
        : [{ appLocale: row.appLocale, bucket: row.bucket }]
    ),
    tables.programBuckets.map((row) => ({ ...row, count: row.routeCount }))
  );
});
