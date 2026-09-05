import { compareCodeUnits } from "@nakafa/aksara-contracts/text/order";
import {
  categoryPosition,
  decodeCategoryPosition,
} from "@repo/backend/content/article/category-cursor";
import {
  articlePublicationCursor,
  decodePublicationPosition,
} from "@repo/backend/content/article/cursor";
import { ArticleSource } from "@repo/backend/content/article/source";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Layer, Option } from "effect";

interface ArticleSnapshot {
  readonly articleBuckets: readonly PublicationRow<"articleBuckets">[];
  readonly articleCatalog: readonly PublicationRow<"articleCatalog">[];
  readonly articleCategories: readonly PublicationRow<"articleCategories">[];
}

/** Requires the immutable article index to have one unambiguous identity. */
const uniqueArticleRow = Effect.fn("article.snapshot.uniqueRow")(function* <
  Row,
>(rows: readonly Row[], identity: string) {
  if (rows.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Signed serving snapshot has duplicate article ${identity} rows.`
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

/** Reads article identities and pages from the verified signed serving generation. */
export const snapshotArticleLayer = (tables: ArticleSnapshot) =>
  Layer.effect(
    ArticleSource,
    Effect.sync(() => {
      const byIdentity = groupRows(tables.articleCatalog, (row) =>
        JSON.stringify([row.slot, row.contentKey, row.appLocale])
      );
      const byPublicPath = groupRows(tables.articleCatalog, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.publicPath])
      );
      const byAssetId = groupRows(tables.articleCatalog, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.assetId])
      );
      const newestFirst = tables.articleCatalog
        .slice()
        .sort(
          (left, right) =>
            compareCodeUnits(right.datePublished, left.datePublished) ||
            compareCodeUnits(right.contentKey, left.contentKey)
        );
      const byLocale = groupRows(newestFirst, (row) =>
        JSON.stringify([row.slot, row.appLocale])
      );
      const byCategory = groupRows(newestFirst, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.category])
      );
      const categoryRows = tables.articleCategories
        .slice()
        .sort((left, right) => compareCodeUnits(left.category, right.category));
      const categoriesByLocale = groupRows(categoryRows, (row) =>
        JSON.stringify([row.slot, row.appLocale])
      );
      const categoriesByBucket = groupRows(categoryRows, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.bucket])
      );
      const articlesByBucket = groupRows(
        tables.articleCatalog
          .slice()
          .sort((left, right) =>
            compareCodeUnits(left.publicPath, right.publicPath)
          ),
        (row) => JSON.stringify([row.slot, row.appLocale, row.bucket])
      );
      const bucketRows = tables.articleBuckets
        .slice()
        .sort((left, right) => compareCodeUnits(left.bucket, right.bucket));
      const bucketsByIdentity = groupRows(bucketRows, (row) =>
        JSON.stringify([row.slot, row.appLocale, row.bucket])
      );
      const bucketsByLocale = groupRows(bucketRows, (row) =>
        JSON.stringify([row.slot, row.appLocale])
      );
      return ArticleSource.of({
        article: Effect.fn("article.snapshot.identity")(
          (slot, contentKey, appLocale) =>
            uniqueArticleRow(
              byIdentity.get(JSON.stringify([slot, contentKey, appLocale])) ??
                [],
              `${contentKey}/${appLocale}`
            )
        ),
        byPublicPath: Effect.fn("article.snapshot.byPublicPath")(
          (slot, appLocale, publicPath) =>
            Effect.sync(() =>
              (
                byPublicPath.get(
                  JSON.stringify([slot, appLocale, publicPath])
                ) ?? []
              ).slice(0, 2)
            )
        ),
        byAssetId: Effect.fn("article.snapshot.byAssetId")(
          (slot, appLocale, assetId) =>
            Effect.sync(() =>
              (
                byAssetId.get(JSON.stringify([slot, appLocale, assetId])) ?? []
              ).slice(0, 2)
            )
        ),
        ordered: Effect.fn("article.snapshot.ordered")(
          (slot, appLocale, category, limit) =>
            Effect.sync(() =>
              (category === null
                ? (byLocale.get(JSON.stringify([slot, appLocale])) ?? [])
                : (byCategory.get(
                    JSON.stringify([slot, appLocale, category])
                  ) ?? [])
              ).slice(0, limit)
            )
        ),
        publications: Effect.fn("article.snapshot.publications")(
          function* (slot, appLocale, category, options) {
            const position = yield* decodePublicationPosition(options.cursor);
            if (
              position !== null &&
              (position[0] !== slot ||
                position[1] !== appLocale ||
                position[2] !== category)
            ) {
              return yield* releaseFail(
                "CONTENT_RELEASE_INTEGRITY",
                "Article publication cursor belongs to another query."
              );
            }
            const rows = (
              byCategory.get(JSON.stringify([slot, appLocale, category])) ?? []
            ).filter(
              (row) =>
                position === null ||
                row.datePublished < position[3] ||
                (row.datePublished === position[3] &&
                  row.contentKey < position[4])
            );
            const page = rows.slice(0, options.numItems);
            const last = page.at(-1);
            return {
              page,
              isDone: rows.length <= options.numItems,
              continueCursor: last
                ? articlePublicationCursor(last)
                : (options.cursor ?? ""),
            };
          }
        ),
        categories: Effect.fn("article.snapshot.categories")(
          function* (slot, appLocale, options) {
            const position = yield* decodeCategoryPosition(
              options.cursor,
              slot,
              appLocale
            );
            const rows = (
              categoriesByLocale.get(JSON.stringify([slot, appLocale])) ?? []
            ).filter((row) => position === null || row.category > position[2]);
            const page = rows.slice(0, options.numItems);
            const last = page.at(-1);
            return {
              page,
              isDone: rows.length <= options.numItems,
              continueCursor: last
                ? categoryPosition(last)
                : (options.cursor ?? ""),
            };
          }
        ),
        partition: Effect.fn("article.snapshot.partition")(
          function* (slot, appLocale, bucket, limit) {
            const count = yield* uniqueArticleRow(
              bucketsByIdentity.get(
                JSON.stringify([slot, appLocale, bucket])
              ) ?? [],
              `bucket ${appLocale}/${bucket}`
            );
            const articles = (
              articlesByBucket.get(JSON.stringify([slot, appLocale, bucket])) ??
              []
            ).slice(0, limit);
            const categories = (
              categoriesByBucket.get(
                JSON.stringify([slot, appLocale, bucket])
              ) ?? []
            ).slice(0, limit);
            return { count, articles, categories };
          }
        ),
        buckets: Effect.fn("article.snapshot.buckets")(
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
