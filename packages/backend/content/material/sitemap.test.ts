import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import {
  readMaterialBuckets,
  readMaterialSitemap,
} from "@repo/backend/content/material/sitemap";
import { CONTENT_BUCKET_LIMIT } from "@repo/backend/convex/contentRelease/bucket";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/material/sitemap", () => {
  it.effect("rejects an index larger than the complete partition space", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      yield* Effect.promise(() => activateMaterialCatalog(target));
      yield* Effect.promise(() =>
        target.mutation(async (ctx) => {
          for (let index = 0; index <= CONTENT_BUCKET_LIMIT; index += 1) {
            await ctx.db.insert("materialBuckets", {
              appLocale: "en",
              bucket: "aaa",
              count: 1,
              slot: "blue",
            });
          }
        })
      );
      yield* Effect.promise(() =>
        expect(
          target.query((ctx) =>
            runConvexProgram(
              readMaterialBuckets("en").pipe(
                Effect.provide(convexMaterialLayer(ctx))
              )
            )
          )
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
    })
  );

  it("returns empty discovery before signed ownership", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialBuckets("en").pipe(
            Effect.provide(convexMaterialLayer(ctx))
          )
        )
      )
    ).resolves.toEqual({
      activeReleaseId: null,
      buckets: [],
      managed: false,
      materialCount: 0,
    });
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialSitemap("en", "abc").pipe(
            Effect.provide(convexMaterialLayer(ctx))
          )
        )
      )
    ).resolves.toBeNull();
  });

  it.each(ACTIVE_APP_LOCALE_CODES)(
    "lists and reads complete %s material partitions",
    async (appLocale) => {
      const target = convexTest(schema, convexModules);
      const first = makeMaterialProjection(appLocale, 1);
      const second = makeMaterialProjection(appLocale, 2);
      await activateMaterialCatalog(target, [first, second]);
      const result = await target.query((ctx) =>
        runConvexProgram(
          readMaterialBuckets(appLocale).pipe(
            Effect.provide(convexMaterialLayer(ctx))
          )
        )
      );

      expect(result).toMatchObject({
        activeReleaseId: MATERIAL_IDENTITY.releaseId,
        managed: true,
        materialCount: 2,
      });
      expect(result.buckets.length).toBeGreaterThan(0);
      const pages = await Promise.all(
        result.buckets.map((bucket) =>
          target.query((ctx) =>
            runConvexProgram(
              readMaterialSitemap(appLocale, bucket).pipe(
                Effect.provide(convexMaterialLayer(ctx))
              )
            )
          )
        )
      );
      expect(pages.flatMap((page) => page?.routes ?? [])).toEqual(
        expect.arrayContaining([
          {
            lastModified: "2026-07-24",
            publicPath: first.publicPath,
          },
          {
            lastModified: "2026-07-24",
            publicPath: second.publicPath,
          },
        ])
      );
    }
  );

  it("rejects malformed stored partition metadata", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);
    await target.mutation((ctx) =>
      ctx.db.insert("materialBuckets", {
        bucket: "invalid",
        count: 0,
        appLocale: "en",
        slot: "blue",
      })
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialBuckets("en").pipe(
            Effect.provide(convexMaterialLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
