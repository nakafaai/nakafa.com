import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { materialLayer } from "@repo/backend/content/material/confect";
import {
  decodeProgramPosition,
  isProgramPosition,
  programPosition,
} from "@repo/backend/content/program/cursor";
import { ProgramSource } from "@repo/backend/content/program/source";
import { Effect, Layer, Option, Predicate } from "effect";

/** Reads program relationships through their existing immutable native indexes. */
export const programLayer = Layer.merge(
  materialLayer,
  Layer.effect(
    ProgramSource,
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      return ProgramSource.of({
        program: Effect.fn("program.database.identity")(
          function* (snapshotId, programKey) {
            return yield* database
              .table("programCatalog")
              .get("by_snapshotId_and_programKey", snapshotId, programKey)
              .pipe(
                Effect.catchTag("GetByIndexFailure", () =>
                  Effect.succeed(null)
                ),
                Effect.orDie,
                Effect.map(Option.fromNullishOr)
              );
          }
        ),
        programs: Effect.fn("program.database.catalog")(
          function* (snapshotId, limit) {
            return yield* database
              .table("programCatalog")
              .index("by_snapshotId_and_displayOrder_and_programKey", (index) =>
                index.eq("snapshotId", snapshotId)
              )
              .take(limit)
              .pipe(Effect.orDie);
          }
        ),
        subjects: Effect.fn("program.database.subjects")(
          function* (snapshotId, appLocale, limit) {
            return yield* database
              .table("curriculumRoutes")
              .index(
                "by_snapshotId_and_appLocale_and_level_and_bucket_and_path",
                (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq("appLocale", appLocale)
                    .eq("level", "subject")
                    // Signed sitemap routes have a bucket; hidden routes omit it.
                    .gte("bucket", "")
              )
              .take(limit)
              .pipe(Effect.orDie);
          }
        ),
        route: Effect.fn("program.database.route")(
          function* (snapshotId, appLocale, publicPath) {
            return yield* database
              .table("curriculumRoutes")
              .get(
                "by_snapshotId_and_appLocale_and_path",
                snapshotId,
                appLocale,
                publicPath
              )
              .pipe(
                Effect.catchTag("GetByIndexFailure", () =>
                  Effect.succeed(null)
                ),
                Effect.orDie,
                Effect.map(Option.fromNullishOr)
              );
          }
        ),
        node: Effect.fn("program.database.node")(
          function* (snapshotId, appLocale, programKey, nodeKey) {
            return yield* database
              .table("curriculumRoutes")
              .get(
                "by_snapshotId_and_appLocale_and_programKey_and_nodeKey",
                snapshotId,
                appLocale,
                programKey,
                nodeKey
              )
              .pipe(
                Effect.catchTag("GetByIndexFailure", () =>
                  Effect.succeed(null)
                ),
                Effect.orDie,
                Effect.map(Option.fromNullishOr)
              );
          }
        ),
        related: Effect.fn("program.database.related")(
          function* (snapshotId, appLocale, relation, publicPath, limit) {
            const routes = database.table("curriculumRoutes");
            const query =
              relation === "children"
                ? routes.index(
                    "by_snapshotId_and_appLocale_and_parentPath_and_order_and_path",
                    (index) =>
                      index
                        .eq("snapshotId", snapshotId)
                        .eq("appLocale", appLocale)
                        .eq("parentPath", publicPath)
                  )
                : routes.index(
                    "by_snapshotId_and_appLocale_and_contextPath_and_order_and_path",
                    (index) =>
                      index
                        .eq("snapshotId", snapshotId)
                        .eq("appLocale", appLocale)
                        .eq("contextPath", publicPath)
                  );
            return yield* query.take(limit).pipe(Effect.orDie);
          }
        ),
        page: Effect.fn("program.database.page")(
          function* (snapshotId, appLocale, options) {
            if (options.cursor !== null && !isProgramPosition(options.cursor)) {
              return yield* database
                .table("curriculumRoutes")
                .index("by_snapshotId_and_appLocale_and_path", (index) =>
                  index.eq("snapshotId", snapshotId).eq("appLocale", appLocale)
                )
                .paginate(options)
                .pipe(Effect.orDie);
            }
            const position = yield* decodeProgramPosition(
              options.cursor,
              snapshotId,
              appLocale
            );
            const stored = yield* database
              .table("curriculumRoutes")
              .index("by_snapshotId_and_appLocale_and_path", (index) => {
                const scoped = index
                  .eq("snapshotId", snapshotId)
                  .eq("appLocale", appLocale);
                return position === null
                  ? scoped
                  : scoped.gt("path", position[2]);
              })
              .paginate({
                ...options,
                cursor: null,
              })
              .pipe(Effect.orDie);
            const last = stored.page.at(-1);
            const split = Predicate.isNullish(stored.splitCursor)
              ? undefined
              : stored.page[Math.floor((stored.page.length - 1) / 2)];
            return {
              ...stored,
              continueCursor: last
                ? programPosition(last)
                : (options.cursor ?? ""),
              ...(split
                ? {
                    splitCursor: programPosition(split),
                  }
                : {}),
            };
          }
        ),
        partition: Effect.fn("program.database.partition")(
          function* (snapshotId, appLocale, bucket, limit) {
            const [count, routes] = yield* Effect.all([
              database
                .table("programBuckets")
                .get(
                  "by_snapshotId_and_appLocale_and_bucket",
                  snapshotId,
                  appLocale,
                  bucket
                )
                .pipe(
                  Effect.catchTag("GetByIndexFailure", () =>
                    Effect.succeed(null)
                  ),
                  Effect.orDie
                ),
              database
                .table("curriculumRoutes")
                .index(
                  "by_snapshotId_and_appLocale_and_bucket_and_path",
                  (index) =>
                    index
                      .eq("snapshotId", snapshotId)
                      .eq("appLocale", appLocale)
                      .eq("bucket", bucket)
                )
                .take(limit)
                .pipe(Effect.orDie),
            ]);
            return {
              count: Option.fromNullishOr(count),
              routes,
            };
          }
        ),
        buckets: Effect.fn("program.database.buckets")(
          function* (snapshotId, appLocale, limit) {
            return yield* database
              .table("programBuckets")
              .index("by_snapshotId_and_appLocale_and_bucket", (index) =>
                index.eq("snapshotId", snapshotId).eq("appLocale", appLocale)
              )
              .take(limit)
              .pipe(Effect.orDie);
          }
        ),
      });
    })
  )
);
