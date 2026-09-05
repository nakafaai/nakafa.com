import { assert, describe, expect, it } from "@effect/vitest";
import {
  canonicalizeMaterialProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

const publication = api.contentRelease.material.publication;
const publications = api.contentRelease.material.publications;
const decodeProjection = Schema.decodeUnknownSync(
  MaterialLessonProjectionSchema
);

describe("contentRelease/material", () => {
  it.effect(
    "returns the exact material identity and date through discovery and sitemap queries",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const source = makeMaterialProjection("en", 1);
        const dateModified = "2026-08-01";
        yield* Effect.promise(() =>
          activateMaterialCatalog(t, [
            {
              ...source,
              metadata: { ...source.metadata, dateModified },
            },
          ])
        );
        const material = api.contentRelease.material;
        const identity = yield* Effect.promise(() =>
          t.query(material.identity, {
            appLocale: "en",
            contentKey: source.contentKey,
            expectedMaterialKey: source.materialKey,
            expectedSectionKey: source.sectionKey,
          })
        );
        expect(identity).toMatchObject({
          managed: true,
          publicPath: source.publicPath,
        });
        const latest = yield* Effect.promise(() =>
          t.query(material.latest, { appLocale: "en", limit: 1 })
        );
        expect(latest.materials).toMatchObject([
          { dateModified, publicPath: source.publicPath },
        ]);
        const buckets = yield* Effect.promise(() =>
          t.query(material.sitemapBuckets, { appLocale: "en" })
        );
        const results = yield* Effect.promise(() =>
          Promise.all(
            buckets.buckets.map(async (bucket) => ({
              bucket: await t.query(material.bucket, {
                appLocale: "en",
                bucket,
              }),
              sitemap: await t.query(material.sitemapPage, {
                appLocale: "en",
                bucket,
              }),
            }))
          )
        );
        expect(
          results.flatMap(({ bucket }) => bucket.materials ?? [])
        ).toMatchObject([{ dateModified, publicPath: source.publicPath }]);
        expect(results.flatMap(({ sitemap }) => sitemap?.routes ?? [])).toEqual(
          [{ lastModified: dateModified, publicPath: source.publicPath }]
        );
      })
  );

  it.effect(
    "preserves bounded split positions and empty material continuations",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateMaterialCatalog(t));
        const first = yield* Effect.promise(() =>
          t.query(publications, {
            appLocale: "en",
            expectedManifestHash: null,
            expectedReleaseId: null,
            paginationOpts: { cursor: null, numItems: 2, maximumRowsRead: 2 },
          })
        );
        expect(first.result).toMatchObject({
          pageStatus: "SplitRequired",
          splitCursor: expect.any(String),
        });
        assert("splitCursor" in first.result && first.result.splitCursor);
        const splitCursor = first.result.splitCursor;
        const identity = {
          appLocale: "en" as const,
          expectedManifestHash: first.activeManifestHash,
          expectedReleaseId: first.activeReleaseId,
        };
        const complete = yield* Effect.promise(() =>
          t.query(publications, {
            ...identity,
            paginationOpts: {
              cursor: first.result.continueCursor,
              numItems: 2,
            },
          })
        );
        expect(complete.result).toMatchObject({
          continueCursor: first.result.continueCursor,
          page: [],
          isDone: true,
        });
        const split = yield* Effect.promise(() =>
          t.query(publications, {
            ...identity,
            paginationOpts: {
              cursor: splitCursor,
              numItems: 2,
            },
          })
        );
        expect(split.result.page).toEqual(first.result.page.slice(1));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            for (const row of await ctx.db.query("materialCatalog").collect()) {
              await ctx.db.delete("materialCatalog", row._id);
            }
          })
        );
        const empty = yield* Effect.promise(() =>
          t.query(publications, {
            appLocale: "en",
            expectedManifestHash: null,
            expectedReleaseId: null,
            paginationOpts: { cursor: null, numItems: 2 },
          })
        );
        expect(empty.result).toMatchObject({ page: [], isDone: true });
      })
  );

  it.effect(
    "restarts an obsolete material cursor before the first publication",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const result = yield* Effect.promise(() =>
          t.query(publications, {
            appLocale: "en",
            expectedManifestHash: "old",
            expectedReleaseId: "old",
            paginationOpts: { cursor: "old-page", numItems: 2 },
          })
        );
        expect(result).toMatchObject({
          activeManifestHash: null,
          activeReleaseId: null,
          managed: false,
          sourceRevision: null,
          stale: true,
        });
      })
  );

  it("fails closed before current signed ownership is available", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(publication, {
        appLocale: "en",
        publicPath: "subjects/mathematics/functions/concept",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });
  });

  it("rejects a route reread after the active release changes", async () => {
    const t = convexTest(schema, convexModules);
    const material = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t);

    await expect(
      t.query(publication, {
        expectedActiveReleaseId: "another-release",
        appLocale: material.appLocale,
        publicPath: material.publicPath,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.query(publication, {
        expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
        appLocale: material.appLocale,
        publicPath: material.publicPath,
      })
    ).resolves.toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
    });
  });

  it.each(["en", "id", "de"] as const)(
    "returns the %s current page with stable release identity",
    async (appLocale) => {
      const t = convexTest(schema, convexModules);
      await activateMaterialCatalog(t);

      const first = await t.query(publications, {
        expectedManifestHash: null,
        expectedReleaseId: null,
        appLocale,
        paginationOpts: { cursor: null, numItems: 1 },
      });
      const second = await t.query(publications, {
        expectedManifestHash: first.activeManifestHash,
        expectedReleaseId: first.activeReleaseId,
        appLocale,
        paginationOpts: {
          cursor: first.result.continueCursor,
          numItems: 1,
        },
      });

      expect(first).toMatchObject({
        activeManifestHash: MATERIAL_IDENTITY.manifestHash,
        activeReleaseId: MATERIAL_IDENTITY.releaseId,
        managed: true,
        result: { isDone: false },
        stale: false,
      });
      expect(second).toMatchObject({
        activeManifestHash: MATERIAL_IDENTITY.manifestHash,
        activeReleaseId: MATERIAL_IDENTITY.releaseId,
        managed: true,
        result: { isDone: true },
        stale: false,
      });
      for (const source of [...first.result.page, ...second.result.page]) {
        const projection = decodeProjection(JSON.parse(source), {
          onExcessProperty: "error",
        });
        expect(projection.appLocale).toBe(appLocale);
        expect(projection.metadata).toHaveProperty("datePublished");
        expect(projection.metadata).not.toHaveProperty("date");
        expect(canonicalizeMaterialProjection(projection)).toBe(source);
      }
    }
  );

  it.each(["en", "id", "de"] as const)(
    "returns the %s current route across alternates and siblings",
    async (appLocale) => {
      const t = convexTest(schema, convexModules);
      const requested = makeMaterialProjection(appLocale, 1);
      await activateMaterialCatalog(t);

      const result = await t.query(publication, {
        appLocale,
        publicPath: requested.publicPath,
      });

      expect(result.projectionJson).toBe(
        canonicalizeMaterialProjection(requested)
      );
      expect(result.alternateJson).toHaveLength(3);
      expect(result.siblingJson).toHaveLength(2);
      for (const source of [
        result.projectionJson ?? "{}",
        ...result.alternateJson,
        ...result.siblingJson,
      ]) {
        const projection = decodeProjection(JSON.parse(source), {
          onExcessProperty: "error",
        });
        expect(projection.metadata).toHaveProperty("datePublished");
        expect(projection.metadata).not.toHaveProperty("date");
        expect(canonicalizeMaterialProjection(projection)).toBe(source);
      }
    }
  );
});
