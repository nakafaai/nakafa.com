import { verifyTryoutPlacement } from "@repo/backend/convex/contentRelease/tryout/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Activates and returns one exact technical placement row. */
async function activatePlacement() {
  const t = convexTest(schema, convexModules);
  const snapshotId = await t.mutation((ctx) =>
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
  const placement = await t.run((ctx) =>
    ctx.db
      .query("tryoutPlacements")
      .withIndex(
        "by_snapshotId_and_appLocale_and_section_and_questionOrder",
        (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("appLocale", "en")
            .eq("countryKey", "indonesia")
            .eq("examKey", "snbt")
            .eq("trackKey", "2027")
            .eq("setKey", "set-1")
            .eq("sectionKey", "quantitative-knowledge")
            .eq("questionOrder", 1)
      )
      .unique()
  );
  if (!placement) {
    throw new Error("Expected one technical placement.");
  }
  return { placement, snapshotId, t };
}

describe("contentRelease/tryout/verify", () => {
  it("authenticates one exact server-only placement", async () => {
    const { placement, snapshotId, t } = await activatePlacement();

    await expect(
      t.query(() =>
        runConvexProgram(verifyTryoutPlacement(placement, snapshotId))
      )
    ).resolves.toMatchObject({
      countryKey: "indonesia",
      questionOrder: 1,
      sectionKey: "quantitative-knowledge",
    });
  });

  it("rejects a placement with lost signed or indexed facts", async () => {
    const lost = await activatePlacement();
    await expect(
      lost.t.query(() =>
        runConvexProgram(
          verifyTryoutPlacement(lost.placement, `sha256:${"0".repeat(64)}`)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const changed = await activatePlacement();
    await changed.t.mutation((ctx) =>
      ctx.db.patch("tryoutPlacements", changed.placement._id, {
        contentHash: "7".repeat(64),
      })
    );
    const tampered = await changed.t.run((ctx) =>
      ctx.db.get(changed.placement._id)
    );
    if (!tampered) {
      throw new Error("Expected one tampered placement.");
    }
    await expect(
      changed.t.query(() =>
        runConvexProgram(verifyTryoutPlacement(tampered, changed.snapshotId))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
