import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { readTryoutMetadata } from "@repo/backend/convex/tryouts/catalog/metadata";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import {
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Activates the smallest coherent two-locale catalog. */
async function activateCatalog() {
  const t = convexTest(schema, convexModules);
  await t.mutation((ctx) =>
    activateTryoutSnapshot(ctx, {
      catalog: [
        makeTryoutCatalogRow("en").record.row,
        makeTryoutCatalogRow("id").record.row,
      ],
      placements: [
        makeTryoutPlacementRow("en").record.row,
        makeTryoutPlacementRow("id").record.row,
      ],
    })
  );
  return t;
}

describe("tryouts/catalog/metadata", () => {
  it("requires an active signed try-out publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutMetadata(ctx, {
            kind: "country",
            locale: "en",
            publicPath: "try-out/indonesia",
          })
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it("returns signed copy and both localized canonical paths", async () => {
    const t = await activateCatalog();

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutMetadata(ctx, {
            kind: "country",
            locale: "en",
            publicPath: "try-out/indonesia",
          })
        )
      )
    ).resolves.toMatchObject({
      route: {
        alternates: [
          { locale: "en", publicPath: "try-out/indonesia" },
          { locale: "id", publicPath: "try-out/indonesia" },
        ],
        publicPath: "try-out/indonesia",
      },
    });
  });

  it("reads exact alternates without loading another complete catalog", async () => {
    const t = await activateCatalog();
    await t.mutation(async (ctx) => {
      const source = await ctx.db
        .query("tryoutCatalog")
        .filter((query) => query.eq(query.field("locale"), "id"))
        .first();
      if (!source) {
        throw new Error("Expected an active Indonesian catalog row.");
      }
      await ctx.db.insert("tryoutCatalog", {
        identity: "unreferenced-catalog-row",
        index: 100,
        kind: "country",
        locale: "id",
        order: 100,
        publicPath: "try-out/unreferenced",
        rowHash: source.rowHash,
        rowJson: source.rowJson,
        snapshotId: source.snapshotId,
      });
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutMetadata(ctx, {
            kind: "country",
            locale: "en",
            publicPath: "try-out/indonesia",
          })
        )
      )
    ).resolves.toMatchObject({
      route: {
        alternates: [
          { locale: "en", publicPath: "try-out/indonesia" },
          { locale: "id", publicPath: "try-out/indonesia" },
        ],
      },
    });
  });

  it("rejects a route requested through the wrong hierarchy kind", async () => {
    const t = await activateCatalog();

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutMetadata(ctx, {
            kind: "exam",
            locale: "en",
            publicPath: "try-out/indonesia",
          })
        )
      )
    ).resolves.toEqual({ route: null });
  });

  it("omits an absent localized counterpart", async () => {
    const t = await activateCatalog();
    await t.mutation(async (ctx) => {
      const alternate = await ctx.db
        .query("tryoutCatalog")
        .filter((query) => query.eq(query.field("locale"), "id"))
        .first();
      if (!alternate) {
        throw new Error("Expected an Indonesian catalog row.");
      }
      await ctx.db.delete("tryoutCatalog", alternate._id);
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutMetadata(ctx, {
            kind: "country",
            locale: "en",
            publicPath: "try-out/indonesia",
          })
        )
      )
    ).resolves.toMatchObject({
      route: {
        alternates: [{ locale: "en", publicPath: "try-out/indonesia" }],
      },
    });
  });

  it("omits a localized internal section without a public path", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: [
          ...makeTryoutStartHierarchy("en", "visible"),
          ...makeTryoutStartHierarchy("id", "internal-entry"),
        ],
        placements: [
          makeTryoutStartPlacement("en"),
          makeTryoutStartPlacement("id"),
        ],
      })
    );
    const publicPath = [
      "try-out",
      TRYOUT_START_COUNTRY,
      TRYOUT_START_EXAM,
      TRYOUT_START_TRACK,
      TRYOUT_START_SET,
      TRYOUT_START_SECTION,
    ].join("/");

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutMetadata(ctx, {
            kind: "section",
            locale: "en",
            publicPath,
          })
        )
      )
    ).resolves.toMatchObject({
      route: {
        alternates: [{ locale: "en", publicPath }],
      },
    });
  });

  it("rejects unknown paths after signed ownership activates", async () => {
    const t = await activateCatalog();

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutMetadata(ctx, {
            kind: "country",
            locale: "id",
            publicPath: "try-out/missing",
          })
        )
      )
    ).resolves.toEqual({ route: null });
  });
});
