import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { readTryoutMetadata } from "@repo/backend/convex/tryouts/catalog/metadata";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
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
  it("delegates metadata before signed ownership activates", async () => {
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
    ).resolves.toEqual({ managed: false, route: null });
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
      managed: true,
      route: {
        alternates: [
          { locale: "en", publicPath: "try-out/indonesia" },
          { locale: "id", publicPath: "try-out/indonesia" },
        ],
        publicPath: "try-out/indonesia",
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
    ).resolves.toEqual({ managed: true, route: null });
  });
});
