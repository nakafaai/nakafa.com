import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { describe, expect, it } from "@repo/testing/effect";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

/** Creates one technical track used to break localized count symmetry. */
function makeTechnicalTrack() {
  return Schema.decodeSync(TryoutCatalogRowSchema)({
    countryKey: "indonesia",
    description: "Technical track",
    examKey: "snbt",
    graph: {
      alignmentId: "alignment:tryout:technical:track",
      assetId: "asset:en:tryout:technical:track",
      conceptId: "concept:tryout:technical:track",
      learningObjectId: "lo:tryout-technical-track",
      lensId: "lens:tryout:technical",
    },
    kind: "track",
    appLocale: "en",
    order: 1,
    publicPath: "try-out/indonesia/snbt/2027",
    questionCount: 1,
    sectionCount: 1,
    setCount: 1,
    sourceRevision: "technical-revision",
    title: "Technical track",
    trackKey: "2027",
    trackKind: "year",
    visibleSectionCount: 1,
  });
}

/** Activates the smallest coherent two-locale catalog. */
async function activateCatalog() {
  const t = convexTest(schema, convexModules);
  const catalog = [
    makeTryoutCatalogRow("en").record.row,
    makeTryoutCatalogRow("id").record.row,
  ];
  const placements = [
    makeTryoutPlacementRow("en").record.row,
    makeTryoutPlacementRow("id").record.row,
  ];
  const snapshotId = await t.mutation((ctx) =>
    activateTryoutSnapshot(ctx, { catalog, placements })
  );
  return { snapshotId, t };
}

describe("contentRelease/tryout/catalog", () => {
  it("requires an active signed try-out publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutCatalog(ctx, "en")))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it.live(
    "returns one verified localized hierarchy from the active snapshot",
    () =>
      Effect.gen(function* () {
        const { snapshotId, t } = yield* Effect.promise(() =>
          activateCatalog()
        );
        const result = yield* Effect.promise(() =>
          t.query((ctx) => runConvexProgram(readTryoutCatalog(ctx, "id")))
        );
        const rows = yield* Effect.forEach(
          result.rowJson,
          decodeSnapshotRowJson
        );

        expect(result).toMatchObject({ snapshotId });
        expect(rows).toMatchObject([
          {
            family: "tryout",
            record: { row: { appLocale: "id", kind: "country" } },
            rowKind: "catalog",
          },
        ]);
      })
  );

  it("requires active signed question ownership", async () => {
    const { t } = await activateCatalog();
    await t.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected one technical release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        resultFamilies: ["material"],
      });
    });

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutCatalog(ctx, "en")))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects asymmetric localized hierarchy counts", async () => {
    const asymmetric = convexTest(schema, convexModules);
    await asymmetric.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: [
          makeTryoutCatalogRow("en").record.row,
          makeTryoutCatalogRow("id").record.row,
          makeTechnicalTrack(),
        ],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
        ],
      })
    );
    await expect(
      asymmetric.query((ctx) => runConvexProgram(readTryoutCatalog(ctx, "en")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("fails closed when one signed row disappears or changes indexed facts", async () => {
    const missing = await activateCatalog();
    await missing.t.mutation(async (ctx) => {
      const row = await ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_appLocale_and_publicPath", (index) =>
          index.eq("snapshotId", missing.snapshotId).eq("appLocale", "en")
        )
        .unique();
      if (!row) {
        throw new Error("Expected one English catalog row.");
      }
      await ctx.db.delete(row._id);
    });
    await expect(
      missing.t.query((ctx) => runConvexProgram(readTryoutCatalog(ctx, "en")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const changed = await activateCatalog();
    await changed.t.mutation(async (ctx) => {
      const row = await ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_appLocale_and_publicPath", (index) =>
          index.eq("snapshotId", changed.snapshotId).eq("appLocale", "en")
        )
        .unique();
      if (!row) {
        throw new Error("Expected one English catalog row.");
      }
      await ctx.db.patch("tryoutCatalog", row._id, { order: 10 });
    });
    await expect(
      changed.t.query((ctx) => runConvexProgram(readTryoutCatalog(ctx, "en")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
