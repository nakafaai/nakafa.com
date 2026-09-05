import { describe, expect, it } from "@effect/vitest";
import { snapshotMaterialLayer } from "@repo/backend/content/material/snapshot";
import { readProgramCatalog } from "@repo/backend/content/program/catalog";
import { readProgramContext } from "@repo/backend/content/program/context";
import { convexProgramLayer } from "@repo/backend/content/program/convex";
import { readProgramPage } from "@repo/backend/content/program/page";
import { readProgramPath } from "@repo/backend/content/program/path";
import { readProgramRoute } from "@repo/backend/content/program/route";
import {
  readProgramBuckets,
  readProgramSitemap,
} from "@repo/backend/content/program/sitemap";
import { snapshotProgramLayer } from "@repo/backend/content/program/snapshot";
import { ProgramSource } from "@repo/backend/content/program/source";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect, Layer, Option, Struct } from "effect";

/** Captures stored fixture rows without database-generated identities. */
async function programSnapshot(ctx: QueryCtx) {
  return {
    contentKeys: [],
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
    programCatalog: (await ctx.db.query("programCatalog").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    curriculumRoutes: (await ctx.db.query("curriculumRoutes").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    programBuckets: (await ctx.db.query("programBuckets").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    materialCatalog: (await ctx.db.query("materialCatalog").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
    materialBuckets: (await ctx.db.query("materialBuckets").collect()).map(
      (row) => Struct.omit(row, ["_id", "_creationTime"])
    ),
  };
}
describe("portable program reads", () => {
  it.effect(
    "returns empty immutable relationships and rejects malformed or foreign route positions",
    () =>
      Effect.gen(function* () {
        const tables = yield* projectActiveRuntime(makeRuntimeSource().source);
        const layer = Layer.mergeAll(
          snapshotPublicationLayer(tables),
          snapshotMaterialLayer(tables),
          snapshotProgramLayer(tables)
        );
        yield* Effect.gen(function* () {
          const source = yield* ProgramSource;
          const options = { cursor: null, numItems: 1 };
          expect(
            Option.isNone(yield* source.program("snapshot", "missing"))
          ).toBe(true);
          expect(yield* source.programs("snapshot", 1)).toEqual([]);
          expect(
            Option.isNone(
              yield* source.route("snapshot", "en", "curricula/missing")
            )
          ).toBe(true);
          expect(
            Option.isNone(
              yield* source.node("snapshot", "en", "missing", "missing")
            )
          ).toBe(true);
          expect(
            yield* source.related("snapshot", "en", "children", undefined, 1)
          ).toEqual([]);
          expect(
            yield* source.related(
              "snapshot",
              "en",
              "contexts",
              "curricula/missing",
              1
            )
          ).toEqual([]);
          expect(yield* source.page("snapshot", "en", options)).toEqual({
            page: [],
            isDone: true,
            continueCursor: "",
          });
          const partition = yield* source.partition("snapshot", "en", "00", 1);
          expect(Option.isNone(partition.count)).toBe(true);
          expect(partition.routes).toEqual([]);
          expect(yield* source.buckets("snapshot", "en", 1)).toEqual([]);
          const last =
            'program-route|["snapshot","en","curricula/algebra/last"]';
          expect(
            yield* source.page("snapshot", "en", { ...options, cursor: last })
          ).toEqual({ page: [], isDone: true, continueCursor: last });
          for (const cursor of [
            "foreign|[]",
            "program-route|{",
            "program-route|[]",
            'program-route|["another","en","curricula/algebra/last"]',
            'program-route|["snapshot","de","curricula/algebra/last"]',
          ]) {
            expect(
              yield* source
                .page("snapshot", "en", { ...options, cursor })
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
    "matches localized catalogs, complete routes, and sitemap partitions without system fields",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(target, data));
        const tables = yield* Effect.promise(() =>
          target.query(programSnapshot)
        );
        const layer = Layer.mergeAll(
          snapshotPublicationLayer(tables),
          snapshotMaterialLayer(tables),
          snapshotProgramLayer(tables)
        );
        expect(
          Object.values(tables)
            .flat()
            .some((row) => "_id" in row || "_creationTime" in row)
        ).toBe(false);
        for (const appLocale of ["en", "id", "de"] as const) {
          const row = tables.curriculumRoutes.find(
            (entry) => entry.appLocale === appLocale
          );
          if (!row) {
            throw new Error("Expected one localized program route.");
          }
          const program = Effect.gen(function* () {
            const result = yield* Effect.all({
              catalog: readProgramCatalog(appLocale),
              route: readProgramRoute(appLocale, row.path),
              path: readProgramPath(appLocale, row.path),
              missing: readProgramRoute(appLocale, "curriculum/missing"),
              context: readProgramContext(appLocale, {
                contentKey: "material/lesson/missing",
                materialKey: "missing",
                nodeKey: row.nodeKey,
                programKey: row.programKey,
                parentPath: row.path,
                publicPath: "subjects/missing",
              }),
              buckets: readProgramBuckets(appLocale),
            });
            const partitions = yield* Effect.forEach(
              result.buckets.buckets,
              (bucket) => readProgramSitemap(appLocale, bucket)
            );
            return { result, partitions };
          });
          const native = yield* Effect.promise(() =>
            target.query((ctx) =>
              runConvexProgram(
                program.pipe(Effect.provide(convexProgramLayer(ctx)))
              )
            )
          );
          const portable = yield* program.pipe(Effect.provide(layer));
          expect(portable).toEqual(native);
        }
      })
  );
  it.effect(
    "continues portable and deployed native route cursors through the same immutable snapshot",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(target, data));
        const tables = yield* Effect.promise(() =>
          target.query(programSnapshot)
        );
        const layer = Layer.mergeAll(
          snapshotPublicationLayer(tables),
          snapshotMaterialLayer(tables),
          snapshotProgramLayer(tables)
        );
        const first = yield* readProgramPage("en", null, null, {
          cursor: null,
          numItems: 1,
        }).pipe(Effect.provide(layer));
        const legacy = yield* Effect.promise(() =>
          target.query((ctx) =>
            ctx.db
              .query("curriculumRoutes")
              .withIndex("by_snapshotId_and_appLocale_and_path", (index) =>
                index.eq("snapshotId", data.snapshotId).eq("appLocale", "en")
              )
              .paginate({ cursor: null, numItems: 1 })
          )
        );
        const next = (cursor: string) =>
          readProgramPage(
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
          legacy.continueCursor,
        ]) {
          const native = yield* Effect.promise(() =>
            target.query((ctx) =>
              runConvexProgram(
                next(cursor).pipe(Effect.provide(convexProgramLayer(ctx)))
              )
            )
          );
          expect(native.result.page).toEqual(portable.result.page);
          expect(native.result.isDone).toBe(true);
        }
        const stale = yield* readProgramPage("en", "old-hash", "old-release", {
          cursor: first.result.continueCursor,
          numItems: 1,
        }).pipe(Effect.provide(layer));
        expect(stale).toMatchObject({ stale: true, result: { page: [] } });
      })
  );
  it.effect(
    "rejects duplicate route ownership and corrupted immutable route metadata",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(target, data));
        const tables = yield* Effect.promise(() =>
          target.query(programSnapshot)
        );
        const row = tables.curriculumRoutes[0];
        if (!row) {
          throw new Error("Expected one curriculum route.");
        }
        for (const curriculumRoutes of [
          [...tables.curriculumRoutes, row],
          tables.curriculumRoutes.map((entry) =>
            entry === row ? { ...entry, rowHash: "sha256:corrupted" } : entry
          ),
        ]) {
          const failure = yield* readProgramRoute(row.appLocale, row.path).pipe(
            Effect.provide(
              Layer.mergeAll(
                snapshotPublicationLayer(tables),
                snapshotMaterialLayer(tables),
                snapshotProgramLayer({ ...tables, curriculumRoutes })
              )
            ),
            Effect.flip
          );
          expect(failure).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }
      })
  );
});
