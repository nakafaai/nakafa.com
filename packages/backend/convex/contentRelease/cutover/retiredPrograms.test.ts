import {
  proveRetiredProgramTablesEmpty,
  RETIRED_PROGRAM_ZERO_RECEIPT,
} from "@repo/backend/convex/contentRelease/cutover/retiredPrograms";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/retiredPrograms", () => {
  it("returns the exact receipt when all six retired tables are empty", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation((ctx) => runConvexProgram(proveRetiredProgramTablesEmpty(ctx)))
    ).resolves.toEqual(RETIRED_PROGRAM_ZERO_RECEIPT);
  });

  it("rejects a nonempty retired program table", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        await ctx.db.insert("learningPrograms", {
          defaultCoverageStatus: "partial",
          displayOrder: 1,
          key: "retired-program",
          kind: "school-curriculum",
          navigation: { levels: ["track"], model: "curriculum-tree" },
          providerKind: "nakafa",
          providerName: "Retired program fixture",
          syncedAt: 1,
          translations: {
            en: { publicSlug: "retired-program", title: "Retired program" },
            id: { publicSlug: "retired-program", title: "Program lama" },
          },
          updatedAt: 1,
          versionLabel: "Legacy",
        });
        await runConvexProgram(proveRetiredProgramTablesEmpty(ctx));
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("learningPrograms is not empty"),
      },
    });
  });
});
