import { assert, describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import {
  activateTryoutStartSource,
  makeTryoutStartHierarchy,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, pipe } from "effect";

describe("public signed try-out publication", () => {
  it.effect(
    "serves the same localized catalog, sitemap, and taxonomy from one signed owner",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const { snapshotId } = yield* Effect.promise(() =>
          t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"))
        );
        for (const appLocale of ACTIVE_APP_LOCALE_CODES) {
          const expected = makeTryoutStartHierarchy(appLocale, "visible");
          const catalog = yield* Effect.promise(() =>
            t.query(api.contentRelease.tryout.catalog, { appLocale })
          );
          expect(catalog).toMatchObject({
            activeReleaseId: TEST_RELEASE_ID,
            snapshotId,
          });
          expect(catalog.rowJson).toHaveLength(expected.length);
          expect(
            Arr.every(catalog.rowJson, (row) =>
              row.includes(`"appLocale":"${appLocale}"`)
            )
          ).toBe(true);
          expect(
            yield* Effect.promise(() =>
              t.query(api.contentRelease.tryout.sitemapCount, { appLocale })
            )
          ).toEqual({ pageCount: 1, routeCount: 5 });
          expect(
            yield* Effect.promise(() =>
              t.query(api.contentRelease.tryout.sitemapPage, {
                appLocale,
                page: 0,
              })
            )
          ).toEqual({
            paths: Arr.map(expected, ({ publicPath }) => publicPath).sort(),
          });
          expect(
            yield* Effect.promise(() =>
              t.query(api.contentRelease.tryout.sitemapPage, {
                appLocale,
                page: 1,
              })
            )
          ).toBeNull();
          expect(
            yield* Effect.promise(() =>
              t.query(api.contentRelease.tryout.taxonomy, { appLocale })
            )
          ).toEqual({
            countries: pipe(
              expected,
              Arr.filter((row) => row.kind === "country"),
              Arr.map((row) => ({ id: row.countryKey, label: row.title }))
            ),
            exams: pipe(
              expected,
              Arr.filter((row) => row.kind === "exam"),
              Arr.map((row) => ({ id: row.examKey, label: row.title }))
            ),
            routeCount: 5,
          });
        }
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const [row] = Arr.filter(
              await ctx.db.query("tryoutCatalog").collect(),
              (candidate) => candidate.appLocale === "id"
            );
            assert(row);
            await ctx.db.patch(row._id, {
              rowHash: `sha256:${"f".repeat(64)}`,
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.tryout.catalog, { appLocale: "id" })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
      })
  );

  it.effect(
    "rejects reads before publication and returns no page for invalid offsets",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.tryout.catalog, { appLocale: "id" })
          ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } })
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"))
        );
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.tryout.sitemapPage, {
              appLocale: "id",
              page: -1,
            })
          ).resolves.toBeNull()
        );
      })
  );
});
