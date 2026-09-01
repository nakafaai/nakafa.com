import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import {
  TEST_HISTORICAL_QUESTION_PROJECTION_JSON,
  TEST_QUESTION_CONTENT_KEY,
  TEST_QUESTION_PROJECTION_JSON,
  TEST_QUESTION_SOURCE,
} from "@repo/backend/test/content/question";
import {
  TEST_RELEASE_ID,
  testUpsertJson,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { beginFixture } from "@repo/backend/test/content/verify";
import { convexTest, type TestConvex } from "convex-test";

const stageItems = internal.contentRelease.items.stageItemBatch;
const stageArtifacts = internal.contentRelease.artifacts.stageArtifactBatch;
const stageProjections = internal.contentRelease.items.stageProjectionBatch;
const stageRollbackProjections =
  internal.contentRelease.items.stageRollbackProjectionBatch;
const verifyItems = internal.contentRelease.verify.verifyItems;

/** Stages one complete Question body through its role-owned projection seam. */
async function stageQuestion(
  t: TestConvex<typeof schema>,
  role: "candidate" | "recovery"
) {
  await t.mutation((ctx) => insertTestRelease(ctx, { role, routeCount: 0 }));
  await t.mutation(stageItems, {
    batchIndex: 0,
    itemJson: [
      testUpsertJson({
        contentKey: TEST_QUESTION_CONTENT_KEY,
        family: "question",
        rendererDomain: "snbt-general",
        sourcePath: TEST_QUESTION_SOURCE,
      }),
    ],
    releaseId: TEST_RELEASE_ID,
  });
  await t.mutation(stageArtifacts, {
    artifactJson: [
      testArtifactJson({
        contentKey: TEST_QUESTION_CONTENT_KEY,
        rendererDomain: "snbt-general",
      }),
    ],
    batchIndex: 0,
    releaseId: TEST_RELEASE_ID,
  });
  const args = {
    batchIndex: 0,
    projectionJson: [
      role === "candidate"
        ? TEST_QUESTION_PROJECTION_JSON
        : TEST_HISTORICAL_QUESTION_PROJECTION_JSON,
    ],
    releaseId: TEST_RELEASE_ID,
  };
  if (role === "candidate") {
    await t.mutation(stageProjections, args);
    return;
  }
  await t.mutation(stageRollbackProjections, args);
}

describe("contentRelease/verify/upsert", () => {
  it("rejects prior Question bytes on candidates but verifies recovery", async () => {
    const candidate = convexTest(schema, convexModules);
    await stageQuestion(candidate, "candidate");
    await candidate.mutation(async (ctx) => {
      const row = await ctx.db.query("contentItems").unique();
      if (!row) {
        throw new Error("Expected staged candidate item.");
      }
      await ctx.db.patch("contentItems", row._id, {
        projectionJson: TEST_HISTORICAL_QUESTION_PROJECTION_JSON,
      });
    });
    await beginFixture(candidate);
    await expect(
      candidate.mutation(verifyItems, {
        afterIndex: -1,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });

    const recovery = convexTest(schema, convexModules);
    await stageQuestion(recovery, "recovery");
    await beginFixture(recovery);
    await expect(
      recovery.mutation(verifyItems, {
        afterIndex: -1,
        releaseId: TEST_RELEASE_ID,
      })
    ).resolves.toMatchObject({ done: true, processed: 1 });
  });
});
