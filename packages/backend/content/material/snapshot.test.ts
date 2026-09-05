import { describe, expect, it } from "@effect/vitest";
import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import {
  readLatestMaterials,
  readMaterialBucket,
} from "@repo/backend/content/material/discovery";
import { readMaterialIdentity } from "@repo/backend/content/material/identity";
import { readMaterialPage } from "@repo/backend/content/material/page";
import { readMaterialModel } from "@repo/backend/content/material/read";
import {
  readMaterialBuckets,
  readMaterialSitemap,
} from "@repo/backend/content/material/sitemap";
import { snapshotMaterialLayer } from "@repo/backend/content/material/snapshot";
import { MaterialSource } from "@repo/backend/content/material/source";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { encodePageCursor } from "@repo/backend/convex/contentRelease/cursor";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Effect, Layer, Option, Struct } from "effect";

/** Copies fixture values without fabricating the database-generated identities. */
async function materialSnapshot(ctx: QueryCtx) {
  return {
    contentKeys: [],
    materialBuckets: (await ctx.db.query("materialBuckets").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentState: (await ctx.db.query("contentState").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentReleases: (await ctx.db.query("contentReleases").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentHeads: (await ctx.db.query("contentHeads").collect()).map((row) =>
      Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentBindings: (await ctx.db.query("contentBindings").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentArtifacts: (await ctx.db.query("contentArtifacts").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    contentSnapshots: (await ctx.db.query("contentSnapshots").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    materialCatalog: (await ctx.db.query("materialCatalog").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
  };
}
describe("portable material source", () => {
  it.effect(
    "keeps empty catalogs empty and rejects malformed or foreign material positions",
    () =>
      Effect.gen(function* () {
        const tables = yield* projectActiveRuntime(makeRuntimeSource().source);
        const layer = Layer.merge(
          snapshotPublicationLayer(tables),
          snapshotMaterialLayer(tables)
        );
        yield* Effect.gen(function* () {
          const source = yield* MaterialSource;
          const options = { cursor: null, numItems: 1 };
          expect(
            Option.isNone(yield* source.material("blue", "missing", "en"))
          ).toBe(true);
          expect(yield* source.siblings("blue", "en", "missing", 1)).toEqual(
            []
          );
          expect(
            yield* source.byPublicPath("blue", "en", "materials/missing")
          ).toEqual([]);
          expect(yield* source.byAssetId("blue", "en", "missing")).toEqual([]);
          expect(
            Option.isNone(
              yield* source.topicByPublicPath("blue", "en", "materials/missing")
            )
          ).toBe(true);
          expect(
            Option.isNone(yield* source.topicByAssetId("blue", "en", "missing"))
          ).toBe(true);
          expect(yield* source.latest("blue", "en", 1)).toEqual([]);
          expect(yield* source.page("blue", "en", options)).toEqual({
            page: [],
            isDone: true,
            continueCursor: "",
          });
          const partition = yield* source.partition("blue", "en", "00", 1);
          expect(Option.isNone(partition.count)).toBe(true);
          expect(partition.materials).toEqual([]);
          expect(yield* source.buckets("blue", "en", 1)).toEqual([]);
          const last = 'material-route|["blue","en","materials/algebra/last"]';
          expect(
            yield* source.page("blue", "en", { ...options, cursor: last })
          ).toEqual({ page: [], isDone: true, continueCursor: last });
          for (const cursor of [
            "foreign|[]",
            "material-route|{",
            "material-route|[]",
            'material-route|["green","en","materials/algebra/last"]',
            'material-route|["blue","de","materials/algebra/last"]',
          ]) {
            expect(
              yield* source
                .page("blue", "en", { ...options, cursor })
                .pipe(Effect.flip)
            ).toMatchObject({
              _tag: "ReleaseError",
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          }
        }).pipe(Effect.provide(layer));
      })
  );
  it.effect(
    "continues portable and deployed native material cursors through the same active catalog",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateMaterialCatalog(target));
        const tables = yield* Effect.promise(() =>
          target.query(materialSnapshot)
        );
        const layer = Layer.merge(
          snapshotPublicationLayer(tables),
          snapshotMaterialLayer(tables)
        );
        const first = yield* readMaterialPage("en", null, null, {
          cursor: null,
          numItems: 1,
        }).pipe(Effect.provide(layer));
        const legacy = yield* Effect.promise(() =>
          target.query((ctx) =>
            ctx.db
              .query("materialCatalog")
              .withIndex("by_slot_and_appLocale_and_publicPath", (index) =>
                index.eq("slot", "blue").eq("appLocale", "en")
              )
              .paginate({ cursor: null, numItems: 1 })
          )
        );
        const next = (cursor: string) =>
          readMaterialPage(
            "en",
            first.activeManifestHash,
            first.activeReleaseId,
            {
              cursor,
              numItems: 1,
            }
          );
        const portable = yield* next(first.result.continueCursor).pipe(
          Effect.provide(layer)
        );
        for (const cursor of [
          first.result.continueCursor,
          encodePageCursor("material", "blue", legacy.continueCursor),
        ]) {
          const native = yield* Effect.promise(() =>
            target.query((ctx) =>
              runConvexProgram(
                next(cursor).pipe(Effect.provide(convexMaterialLayer(ctx)))
              )
            )
          );
          expect(native.result.page).toEqual(portable.result.page);
          expect(native.result.isDone).toBe(true);
        }
      })
  );
  it.effect(
    "matches native routes, locale counterparts, sibling ordering, and stable identity without system fields",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateMaterialCatalog(target));
        const tables = yield* Effect.promise(() =>
          target.query(materialSnapshot)
        );
        const layer = Layer.merge(
          snapshotPublicationLayer(tables),
          snapshotMaterialLayer(tables)
        );
        expect(
          Object.values(tables)
            .flat()
            .some((row) => "_id" in row || "_creationTime" in row)
        ).toBe(false);
        for (const appLocale of ["en", "id", "de"] as const) {
          const projection = makeMaterialProjection(appLocale, 1);
          const identity = {
            appLocale,
            contentKey: projection.contentKey,
            expectedMaterialKey: projection.materialKey,
            expectedSectionKey: projection.sectionKey,
          };
          const program = Effect.gen(function* () {
            const source = yield* MaterialSource;
            const topic = yield* deriveMaterialTopicReference(projection);
            const result = yield* Effect.all({
              found: readMaterialModel(appLocale, projection.publicPath),
              missing: readMaterialModel(appLocale, "subjects/missing"),
              identity: readMaterialIdentity(identity),
              latest: readLatestMaterials(appLocale, 2),
              buckets: readMaterialBuckets(appLocale),
              routeReference: source
                .byPublicPath("blue", appLocale, projection.publicPath)
                .pipe(
                  Effect.map((rows) => rows.map(({ contentKey }) => contentKey))
                ),
              assetReference: source
                .byAssetId("blue", appLocale, projection.graph.assetId)
                .pipe(
                  Effect.map((rows) => rows.map(({ contentKey }) => contentKey))
                ),
              topicRoute: source
                .topicByPublicPath("blue", appLocale, projection.parentPath)
                .pipe(
                  Effect.map(Option.map(({ contentKey }) => contentKey)),
                  Effect.map(Option.getOrNull)
                ),
              topicAsset: source
                .topicByAssetId("blue", appLocale, topic.graph.assetId)
                .pipe(
                  Effect.map(Option.map(({ contentKey }) => contentKey)),
                  Effect.map(Option.getOrNull)
                ),
            });
            const partitions = yield* Effect.forEach(
              result.buckets.buckets,
              (bucket) =>
                Effect.all({
                  sitemap: readMaterialSitemap(appLocale, bucket),
                  discovery: readMaterialBucket(appLocale, bucket),
                })
            );
            return { result, partitions };
          });
          const native = yield* Effect.promise(() =>
            target.query((ctx) =>
              runConvexProgram(
                program.pipe(Effect.provide(convexMaterialLayer(ctx)))
              )
            )
          );
          const portable = yield* program.pipe(Effect.provide(layer));
          expect(portable).toEqual(native);
        }
      })
  );
  it.effect(
    "fails with the same typed publication error when a related locale loses its provenance",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateMaterialCatalog(target));
        const requested = makeMaterialProjection("en", 1);
        yield* Effect.promise(() =>
          target.mutation(async (ctx) => {
            const row = await ctx.db
              .query("materialCatalog")
              .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
                index
                  .eq("slot", "blue")
                  .eq("contentKey", requested.contentKey)
                  .eq("appLocale", "id")
              )
              .unique();
            if (!row) {
              throw new Error("Expected one material counterpart.");
            }
            await ctx.db.patch("materialCatalog", row._id, {
              sourcePath: "corrupted/source.mdx",
            });
          })
        );
        const tables = yield* Effect.promise(() =>
          target.query(materialSnapshot)
        );
        const program = readMaterialModel("en", requested.publicPath);
        const native = yield* Effect.promise(() =>
          target.query((ctx) =>
            runConvexProgram(
              program.pipe(
                Effect.provide(convexMaterialLayer(ctx)),
                Effect.flip,
                Effect.orDie,
                Effect.map((failure) => ({
                  code: failure.code,
                  message: failure.message,
                }))
              )
            )
          )
        );
        const portable = yield* program.pipe(
          Effect.provide(
            Layer.merge(
              snapshotPublicationLayer(tables),
              snapshotMaterialLayer(tables)
            )
          ),
          Effect.flip
        );
        expect(portable).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_INTEGRITY",
          message: native.message,
        });
      })
  );
  it.effect(
    "rejects duplicate portable identities before accepting a material route",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateMaterialCatalog(target));
        const tables = yield* Effect.promise(() =>
          target.query(materialSnapshot)
        );
        const requested = makeMaterialProjection("en", 1);
        const row = tables.materialCatalog.find(
          (entry) =>
            entry.contentKey === requested.contentKey &&
            entry.appLocale === "en"
        );
        expect(row).toBeDefined();
        if (!row) {
          throw new Error("Expected the requested material row.");
        }
        const duplicated = {
          ...tables,
          materialCatalog: [...tables.materialCatalog, row],
        };
        const failure = yield* readMaterialModel(
          "en",
          requested.publicPath
        ).pipe(
          Effect.provide(
            Layer.merge(
              snapshotPublicationLayer(duplicated),
              snapshotMaterialLayer(duplicated)
            )
          ),
          Effect.flip
        );
        expect(failure).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_INTEGRITY",
        });
      })
  );
});
