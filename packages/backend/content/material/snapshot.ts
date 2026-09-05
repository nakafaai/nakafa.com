import { compareCodeUnits } from "@nakafa/aksara-contracts/text/order";
import {
  decodeMaterialPosition,
  materialPosition,
} from "@repo/backend/content/material/cursor";
import { MaterialSource } from "@repo/backend/content/material/source";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Layer, Option } from "effect";

interface MaterialSnapshot {
  readonly materialBuckets: readonly PublicationRow<"materialBuckets">[];
  readonly materialCatalog: readonly PublicationRow<"materialCatalog">[];
}

/** Requires an unambiguous stable material identity in the selected generation. */
const uniqueMaterialRow = Effect.fn("material.snapshot.uniqueRow")(function* <
  Row,
>(rows: readonly Row[], identity: string) {
  if (rows.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Signed serving snapshot has duplicate material ${identity} rows.`
    );
  }
  return Option.fromUndefinedOr(rows[0]);
});

/** Groups validated rows without changing the source arrays or their ordering. */
function groupRows<Row>(rows: readonly Row[], identity: (row: Row) => string) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = identity(row);
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }
  return groups;
}

/** Builds immutable material indexes once for one verified serving generation. */
export const snapshotMaterialLayer = (tables: MaterialSnapshot) =>
  Layer.effect(
    MaterialSource,
    Effect.sync(() => {
      const byIdentity = groupRows(tables.materialCatalog, (row) =>
        JSON.stringify([row.slot, row.contentKey, row.appLocale])
      );
      const paths = tables.materialCatalog
        .slice()
        .sort((left, right) =>
          compareCodeUnits(left.publicPath, right.publicPath)
        );
      const byPublicPath = groupRows(paths, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.publicPath])
      );
      const byAssetId = groupRows(paths, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.assetId])
      );
      const byLocale = groupRows(paths, (row) =>
        JSON.stringify([row.slot, row.appLocale])
      );
      const byBucket = groupRows(paths, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.bucket])
      );
      const authoredOrder = paths
        .slice()
        .sort(
          (left, right) =>
            left.order - right.order ||
            compareCodeUnits(left.publicPath, right.publicPath)
        );
      const byMaterial = groupRows(authoredOrder, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.materialKey])
      );
      const byParentPath = groupRows(authoredOrder, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.parentPath])
      );
      const byTopicAsset = groupRows(
        paths
          .slice()
          .sort((left, right) => compareCodeUnits(left.assetId, right.assetId)),
        (row) => JSON.stringify([row.slot, row.appLocale, row.topicAssetId])
      );
      const newestFirst = paths
        .slice()
        .sort(
          (left, right) =>
            compareCodeUnits(right.datePublished, left.datePublished) ||
            compareCodeUnits(right.contentKey, left.contentKey)
        );
      const latestByLocale = groupRows(newestFirst, (row) =>
        JSON.stringify([row.slot, row.appLocale])
      );
      const buckets = tables.materialBuckets
        .slice()
        .sort((left, right) => compareCodeUnits(left.bucket, right.bucket));
      const bucketsByIdentity = groupRows(buckets, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.bucket])
      );
      const bucketsByLocale = groupRows(buckets, (row) =>
        JSON.stringify([row.slot, row.appLocale])
      );
      return MaterialSource.of({
        material: Effect.fn("material.snapshot.identity")(
          (slot, contentKey, appLocale) =>
            uniqueMaterialRow(
              byIdentity.get(JSON.stringify([slot, contentKey, appLocale])) ??
                [],
              `${contentKey}/${appLocale}`
            )
        ),
        siblings: Effect.fn("material.snapshot.siblings")(
          (slot, appLocale, materialKey, limit) =>
            Effect.sync(() =>
              (
                byMaterial.get(
                  JSON.stringify([slot, appLocale, materialKey])
                ) ?? []
              ).slice(0, limit)
            )
        ),
        byPublicPath: Effect.fn("material.snapshot.byPublicPath")(
          (slot, appLocale, publicPath) =>
            Effect.sync(() =>
              (
                byPublicPath.get(
                  JSON.stringify([slot, appLocale, publicPath])
                ) ?? []
              ).slice(0, 2)
            )
        ),
        byAssetId: Effect.fn("material.snapshot.byAssetId")(
          (slot, appLocale, assetId) =>
            Effect.sync(() =>
              (
                byAssetId.get(JSON.stringify([slot, appLocale, assetId])) ?? []
              ).slice(0, 2)
            )
        ),
        topicByPublicPath: Effect.fn("material.snapshot.topicByPublicPath")(
          (slot, appLocale, publicPath) =>
            Effect.sync(() =>
              Option.fromUndefinedOr(
                byParentPath.get(
                  JSON.stringify([slot, appLocale, publicPath])
                )?.[0]
              )
            )
        ),
        topicByAssetId: Effect.fn("material.snapshot.topicByAssetId")(
          (slot, appLocale, assetId) =>
            Effect.sync(() =>
              Option.fromUndefinedOr(
                byTopicAsset.get(
                  JSON.stringify([slot, appLocale, assetId])
                )?.[0]
              )
            )
        ),
        latest: Effect.fn("material.snapshot.latest")(
          (slot, appLocale, limit) =>
            Effect.sync(() =>
              (
                latestByLocale.get(JSON.stringify([slot, appLocale])) ?? []
              ).slice(0, limit)
            )
        ),
        page: Effect.fn("material.snapshot.page")(
          function* (slot, appLocale, options) {
            const position = yield* decodeMaterialPosition(
              options.cursor,
              slot,
              appLocale
            );
            const rows = (
              byLocale.get(JSON.stringify([slot, appLocale])) ?? []
            ).filter(
              (row) => position === null || row.publicPath > position[2]
            );
            const page = rows.slice(0, options.numItems);
            const last = page.at(-1);
            return {
              page,
              isDone: rows.length <= options.numItems,
              continueCursor: last
                ? materialPosition(last)
                : (options.cursor ?? ""),
            };
          }
        ),
        partition: Effect.fn("material.snapshot.partition")(
          function* (slot, appLocale, bucket, limit) {
            const count = yield* uniqueMaterialRow(
              bucketsByIdentity.get(
                JSON.stringify([slot, appLocale, bucket])
              ) ?? [],
              `bucket ${appLocale}/${bucket}`
            );
            const materials = (
              byBucket.get(JSON.stringify([slot, appLocale, bucket])) ?? []
            ).slice(0, limit);
            return { count, materials };
          }
        ),
        buckets: Effect.fn("material.snapshot.buckets")(
          (slot, appLocale, limit) =>
            Effect.sync(() =>
              (
                bucketsByLocale.get(JSON.stringify([slot, appLocale])) ?? []
              ).slice(0, limit)
            )
        ),
      });
    })
  );
