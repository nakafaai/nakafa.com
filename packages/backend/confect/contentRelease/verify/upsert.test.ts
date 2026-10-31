import { describe, expect, it } from "@effect/vitest";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { FUNCTION_MATERIAL } from "@repo/backend/test/content/material";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import {
  beginFixture,
  stageUpsertFixture,
} from "@repo/backend/test/content/verify";
import { encodeJsonText } from "@repo/utilities/json";
import { convexTest } from "convex-test";

const verifyItems = internal.contentRelease.verify.verifyItems;

describe("contentRelease/verify/upsert", () => {
  it.each(["candidate", "recovery"] as const)(
    "verifies a strict routed body for a signed %s release",
    async (role) => {
      const t = convexTest(schema, convexModules);
      await stageUpsertFixture(t, "material", role);
      await beginFixture(t);
      await expect(
        t.mutation(verifyItems, { afterIndex: -1, releaseId: TEST_RELEASE_ID })
      ).resolves.toMatchObject({ done: true, processed: 1 });
    }
  );

  it.each(["candidate", "recovery"] as const)(
    "rejects an altered body during %s verification",
    async (role) => {
      const t = convexTest(schema, convexModules);
      await stageUpsertFixture(t, "material", role);
      await t.mutation(async (ctx) => {
        const row = await ctx.db.query("contentItems").unique();
        if (!row) {
          throw new Error("Expected one staged item.");
        }
        await ctx.db.patch("contentItems", row._id, {
          projectionJson: encodeJsonText({ ...FUNCTION_MATERIAL, choices: [] }),
        });
      });
      await beginFixture(t);
      await expect(
        t.mutation(verifyItems, { afterIndex: -1, releaseId: TEST_RELEASE_ID })
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    }
  );
});
