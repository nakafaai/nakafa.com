import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Array as Arr, Effect } from "effect";

const program = api.contentRelease.program;
const appLocale = "en";
const publicPath = "curriculum/technical-program-1";
describe("contentRelease/program registered queries", () => {
  it.effect(
    "returns the current catalog, route, path and sitemap identity",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const data = yield* makeProgramSnapshotData();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              activateProgramSnapshot(data).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const [catalog, route, path, buckets] = yield* Effect.promise(() =>
          Promise.all([
            t.query(program.catalog, {
              appLocale,
            }),
            t.query(program.route, {
              appLocale,
              publicPath,
            }),
            t.query(program.path, {
              appLocale,
              publicPath,
            }),
            t.query(program.sitemapBuckets, {
              appLocale,
            }),
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
        expect(buckets).toMatchObject({
          managed: true,
          routeCount: 2,
        });
        const sitemap = yield* Effect.promise(() =>
          Promise.all(
            Arr.map(buckets.buckets, (bucket) =>
              t.query(program.sitemapPage, {
                appLocale,
                bucket,
              })
            )
          )
        );
        expect(
          Arr.flatMap(sitemap, (page) => page?.routes ?? [])
        ).toContainEqual({
          publicPath,
        });
      })
  );
  it.effect("returns unmanaged before publication", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const route = yield* Effect.promise(() =>
        t.query(program.route, {
          appLocale,
          publicPath,
        })
      );
      expect(route).toMatchObject({
        managed: false,
        activeReleaseId: null,
        activeManifestHash: null,
      });
    })
  );
  it.effect("rejects a curriculum route whose owning program disappeared", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const data = yield* makeProgramSnapshotData();
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            activateProgramSnapshot(data).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          for (const row of await ctx.db.query("programCatalog").collect()) {
            await ctx.db.delete("programCatalog", row._id);
          }
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.query(program.route, {
            appLocale,
            publicPath,
          })
        ).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_INTEGRITY",
          },
        })
      );
    })
  );
});
