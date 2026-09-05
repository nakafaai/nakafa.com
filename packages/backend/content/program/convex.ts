import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import {
  decodeProgramPosition,
  isProgramPosition,
  programPosition,
} from "@repo/backend/content/program/cursor";
import { ProgramSource } from "@repo/backend/content/program/source";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect, Layer, Option } from "effect";

/** Reads program relationships through their existing immutable native indexes. */
export const convexProgramLayer = (ctx: QueryCtx) =>
  Layer.merge(
    convexMaterialLayer(ctx),
    Layer.succeed(ProgramSource, {
      program: Effect.fn("program.convex.identity")((snapshotId, programKey) =>
        Effect.promise(() =>
          ctx.db
            .query("programCatalog")
            .withIndex("by_snapshotId_and_programKey", (index) =>
              index.eq("snapshotId", snapshotId).eq("programKey", programKey)
            )
            .unique()
        ).pipe(Effect.map(Option.fromNullishOr))
      ),
      programs: Effect.fn("program.convex.catalog")((snapshotId, limit) =>
        Effect.promise(() =>
          ctx.db
            .query("programCatalog")
            .withIndex(
              "by_snapshotId_and_displayOrder_and_programKey",
              (index) => index.eq("snapshotId", snapshotId)
            )
            .take(limit)
        )
      ),
      route: Effect.fn("program.convex.route")(
        (snapshotId, appLocale, publicPath) =>
          Effect.promise(() =>
            ctx.db
              .query("curriculumRoutes")
              .withIndex("by_snapshotId_and_appLocale_and_path", (index) =>
                index
                  .eq("snapshotId", snapshotId)
                  .eq("appLocale", appLocale)
                  .eq("path", publicPath)
              )
              .unique()
          ).pipe(Effect.map(Option.fromNullishOr))
      ),
      node: Effect.fn("program.convex.node")(
        (snapshotId, appLocale, programKey, nodeKey) =>
          Effect.promise(() =>
            ctx.db
              .query("curriculumRoutes")
              .withIndex(
                "by_snapshotId_and_appLocale_and_programKey_and_nodeKey",
                (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq("appLocale", appLocale)
                    .eq("programKey", programKey)
                    .eq("nodeKey", nodeKey)
              )
              .unique()
          ).pipe(Effect.map(Option.fromNullishOr))
      ),
      related: Effect.fn("program.convex.related")(
        (snapshotId, appLocale, relation, publicPath, limit) =>
          Effect.promise(() =>
            relation === "children"
              ? ctx.db
                  .query("curriculumRoutes")
                  .withIndex(
                    "by_snapshotId_and_appLocale_and_parentPath_and_order_and_path",
                    (index) =>
                      index
                        .eq("snapshotId", snapshotId)
                        .eq("appLocale", appLocale)
                        .eq("parentPath", publicPath)
                  )
                  .take(limit)
              : ctx.db
                  .query("curriculumRoutes")
                  .withIndex(
                    "by_snapshotId_and_appLocale_and_contextPath_and_order_and_path",
                    (index) =>
                      index
                        .eq("snapshotId", snapshotId)
                        .eq("appLocale", appLocale)
                        .eq("contextPath", publicPath)
                  )
                  .take(limit)
          )
      ),
      page: Effect.fn("program.convex.page")(
        function* (snapshotId, appLocale, options) {
          if (options.cursor !== null && !isProgramPosition(options.cursor)) {
            return yield* Effect.promise(() =>
              ctx.db
                .query("curriculumRoutes")
                .withIndex("by_snapshotId_and_appLocale_and_path", (index) =>
                  index.eq("snapshotId", snapshotId).eq("appLocale", appLocale)
                )
                .paginate(options)
            );
          }
          const position = yield* decodeProgramPosition(
            options.cursor,
            snapshotId,
            appLocale
          );
          const stored = yield* Effect.promise(() =>
            ctx.db
              .query("curriculumRoutes")
              .withIndex("by_snapshotId_and_appLocale_and_path", (index) => {
                const scoped = index
                  .eq("snapshotId", snapshotId)
                  .eq("appLocale", appLocale);
                return position === null
                  ? scoped
                  : scoped.gt("path", position[2]);
              })
              .paginate({ ...options, cursor: null })
          );
          const last = stored.page.at(-1);
          const split =
            stored.splitCursor == null
              ? undefined
              : stored.page[Math.floor((stored.page.length - 1) / 2)];
          return {
            ...stored,
            continueCursor: last
              ? programPosition(last)
              : (options.cursor ?? ""),
            ...(split ? { splitCursor: programPosition(split) } : {}),
          };
        }
      ),
      partition: Effect.fn("program.convex.partition")(
        function* (snapshotId, appLocale, bucket, limit) {
          const [count, routes] = yield* Effect.all([
            Effect.promise(() =>
              ctx.db
                .query("programBuckets")
                .withIndex("by_snapshotId_and_appLocale_and_bucket", (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq("appLocale", appLocale)
                    .eq("bucket", bucket)
                )
                .unique()
            ),
            Effect.promise(() =>
              ctx.db
                .query("curriculumRoutes")
                .withIndex(
                  "by_snapshotId_and_appLocale_and_bucket_and_path",
                  (index) =>
                    index
                      .eq("snapshotId", snapshotId)
                      .eq("appLocale", appLocale)
                      .eq("bucket", bucket)
                )
                .take(limit)
            ),
          ]);
          return { count: Option.fromNullishOr(count), routes };
        }
      ),
      buckets: Effect.fn("program.convex.buckets")(
        (snapshotId, appLocale, limit) =>
          Effect.promise(() =>
            ctx.db
              .query("programBuckets")
              .withIndex("by_snapshotId_and_appLocale_and_bucket", (index) =>
                index.eq("snapshotId", snapshotId).eq("appLocale", appLocale)
              )
              .take(limit)
          )
      ),
    })
  );
