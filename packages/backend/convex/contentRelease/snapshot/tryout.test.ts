import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot-data";
import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import {
  stageTryoutCatalog,
  stageTryoutPlacement,
} from "@repo/backend/convex/contentRelease/snapshot/tryout";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const snapshotId = Sha256HashSchema.make(`sha256:${"7".repeat(64)}`);
describe("contentRelease/snapshot/tryout", () => {
  it("stores hierarchy and placement rows in domain-owned tables", async () => {
    const catalog = makeTryoutCatalogRow();
    const placement = makeTryoutPlacementRow();
    const catalogJson = canonicalizeContentSnapshotRow(catalog);
    const placementJson = canonicalizeContentSnapshotRow(placement);
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          stageTryoutCatalog(ctx, snapshotId, 0, catalog, catalogJson)
        )
      )
    ).resolves.toBe(false);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          stageTryoutPlacement(ctx, snapshotId, 1, placement, placementJson)
        )
      )
    ).resolves.toBe(false);
    await expect(
      t.run(async (ctx) => ({
        catalog: await ctx.db.query("tryoutCatalog").unique(),
        placement: await ctx.db.query("tryoutPlacements").unique(),
      }))
    ).resolves.toMatchObject({
      catalog: {
        identity: tryoutCatalogIdentity(catalog.record.row),
        kind: "country",
      },
      placement: {
        answerArtifactHash: placement.record.row.answerArtifactHash,
        identity: tryoutPlacementIdentity(placement.record.row),
        questionArtifactHash: placement.record.row.questionArtifactHash,
        questionOrder: 1,
      },
    });
  });

  it("replays exact rows and rejects index or identity collisions", async () => {
    const catalog = makeTryoutCatalogRow();
    const rowJson = canonicalizeContentSnapshotRow(catalog);
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      runConvexProgram(stageTryoutCatalog(ctx, snapshotId, 0, catalog, rowJson))
    );
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          stageTryoutCatalog(ctx, snapshotId, 0, catalog, rowJson)
        )
      )
    ).resolves.toBe(true);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          stageTryoutCatalog(ctx, snapshotId, 1, catalog, rowJson)
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });
});
