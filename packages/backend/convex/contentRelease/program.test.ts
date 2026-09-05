import { assert, describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const program = api.contentRelease.program;
const appLocale = "en";
const publicPath = "curriculum/technical-program-1";

describe("contentRelease/program registered queries", () => {
  it.effect(
    "returns the current catalog, route, path and sitemap identity",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const data = yield* makeProgramSnapshotData();
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        const [catalog, route, path, buckets] = yield* Effect.promise(() =>
          Promise.all([
            t.query(program.catalog, { appLocale }),
            t.query(program.route, { appLocale, publicPath }),
            t.query(program.path, { appLocale, publicPath }),
            t.query(program.sitemapBuckets, { appLocale }),
          ])
        );
        expect(catalog).toMatchObject({
          managed: true,
          snapshotId: data.snapshotId,
          programJson: [expect.any(String), expect.any(String)],
          routeJson: [expect.any(String), expect.any(String)],
        });
        expect(route).toMatchObject({
          managed: true,
          snapshotId: data.snapshotId,
          alternateJson: [
            expect.any(String),
            expect.any(String),
            expect.any(String),
          ],
          routeJson: path.routeJson,
        });
        expect(path.managed).toBe(true);
        expect(buckets).toMatchObject({ managed: true, routeCount: 2 });
        const sitemap = yield* Effect.promise(() =>
          Promise.all(
            buckets.buckets.map((bucket) =>
              t.query(program.sitemapPage, { appLocale, bucket })
            )
          )
        );
        expect(sitemap.flatMap((page) => page?.routes ?? [])).toContainEqual({
          publicPath,
        });
      })
  );

  it.effect(
    "keeps split and completed cursors bound to the active snapshot",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const data = yield* makeProgramSnapshotData();
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        const first = yield* Effect.promise(() =>
          t.query(program.page, {
            appLocale,
            expectedManifestHash: null,
            expectedReleaseId: null,
            paginationOpts: { cursor: null, maximumRowsRead: 2, numItems: 2 },
          })
        );
        expect(first.result).toMatchObject({
          page: [expect.any(String), expect.any(String)],
          pageStatus: "SplitRequired",
          splitCursor: expect.stringContaining("program-route|"),
        });
        assert("splitCursor" in first.result && first.result.splitCursor);
        const splitCursor = first.result.splitCursor;
        const identity = {
          appLocale,
          expectedManifestHash: first.activeManifestHash,
          expectedReleaseId: first.activeReleaseId,
        } as const;
        const complete = yield* Effect.promise(() =>
          t.query(program.page, {
            ...identity,
            paginationOpts: {
              cursor: first.result.continueCursor,
              numItems: 2,
            },
          })
        );
        expect(complete.result).toMatchObject({
          continueCursor: first.result.continueCursor,
          isDone: true,
          page: [],
        });
        const split = yield* Effect.promise(() =>
          t.query(program.page, {
            ...identity,
            paginationOpts: {
              cursor: splitCursor,
              numItems: 2,
            },
          })
        );
        expect(split.result.page).toEqual(first.result.page.slice(1));
        yield* Effect.promise(() =>
          expect(
            t.query(program.page, {
              ...identity,
              paginationOpts: {
                cursor: first.result.continueCursor,
                endCursor: "foreign",
                numItems: 2,
              },
            })
          ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } })
        );
      })
  );

  it.effect(
    "returns an empty native page after the last curriculum route is removed",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const data = yield* makeProgramSnapshotData();
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            for (const row of await ctx.db
              .query("curriculumRoutes")
              .collect()) {
              await ctx.db.delete("curriculumRoutes", row._id);
            }
          })
        );
        const result = yield* Effect.promise(() =>
          t.query(program.page, {
            appLocale,
            expectedManifestHash: null,
            expectedReleaseId: null,
            paginationOpts: { cursor: null, endCursor: null, numItems: 2 },
          })
        );
        expect(result.result).toMatchObject({
          continueCursor: "",
          isDone: true,
          page: [],
        });
      })
  );

  it.effect(
    "returns unmanaged and restarts an obsolete page before publication",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const route = yield* Effect.promise(() =>
          t.query(program.route, { appLocale, publicPath })
        );
        expect(route).toMatchObject({
          managed: false,
          activeReleaseId: null,
          activeManifestHash: null,
        });
        const stale = yield* Effect.promise(() =>
          t.query(program.page, {
            appLocale,
            expectedManifestHash: "obsolete-manifest",
            expectedReleaseId: "obsolete-release",
            paginationOpts: { cursor: "obsolete-cursor", numItems: 2 },
          })
        );
        expect(stale).toMatchObject({
          activeManifestHash: null,
          activeReleaseId: null,
          managed: false,
          result: { isDone: true, page: [] },
          snapshotId: null,
          sourceRevision: null,
          stale: true,
        });
      })
  );

  it.effect("rejects a curriculum route whose owning program disappeared", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const data = yield* makeProgramSnapshotData();
      yield* Effect.promise(() => activateProgramSnapshot(t, data));
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          for (const row of await ctx.db.query("programCatalog").collect()) {
            await ctx.db.delete("programCatalog", row._id);
          }
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.query(program.route, { appLocale, publicPath })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
    })
  );
});
