import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { writeUpsert } from "@repo/backend/convex/contentRelease/verify/upsert";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import {
  TEST_QUESTION_CONTENT_KEY,
  TEST_QUESTION_PROJECTION,
  TEST_QUESTION_PROJECTION_JSON,
  TEST_QUESTION_SOURCE,
} from "@repo/backend/test/content/question";
import {
  TEST_RELEASE_ID,
  testDeleteJson,
  testUpsertJson,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { beginFixture } from "@repo/backend/test/content/verify";
import { convexTest, type TestConvex } from "convex-test";

const stageItems = internal.contentRelease.items.stageItemBatch;
const stageArtifacts = internal.contentRelease.artifacts.stageArtifactBatch;
const stageProjections = internal.contentRelease.items.stageProjectionBatch;
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
  await t.mutation(stageProjections, {
    batchIndex: 0,
    projectionJson: [TEST_QUESTION_PROJECTION_JSON],
    releaseId: TEST_RELEASE_ID,
  });
}

describe("contentRelease/verify/upsert", () => {
  it("rejects a delete item supplied to the upsert writer", async () => {
    const t = convexTest(schema, convexModules);
    await stageQuestion(t, "candidate");
    await expect(
      t.mutation(async (ctx) => {
        const row = await ctx.db.query("contentItems").unique();
        if (!row) {
          throw new Error("Expected staged Question item.");
        }
        return runConvexProgram(
          writeUpsert(ctx, {
            ...row,
            itemJson: testDeleteJson({
              contentKey: TEST_QUESTION_CONTENT_KEY,
              family: "question",
            }),
          })
        );
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it.each(["candidate", "recovery"] as const)(
    "verifies strict Question bodies for a signed %s release",
    async (role) => {
      const t = convexTest(schema, convexModules);
      await stageQuestion(t, role);
      await beginFixture(t);
      await expect(
        t.mutation(verifyItems, { afterIndex: -1, releaseId: TEST_RELEASE_ID })
      ).resolves.toMatchObject({ done: true, processed: 1 });
    }
  );

  it.each(["candidate", "recovery"] as const)(
    "rejects altered Question bodies during %s verification",
    async (role) => {
      const t = convexTest(schema, convexModules);
      await stageQuestion(t, role);
      await t.mutation(async (ctx) => {
        const row = await ctx.db.query("contentItems").unique();
        if (!row) {
          throw new Error("Expected staged Question item.");
        }
        await ctx.db.patch("contentItems", row._id, {
          projectionJson: JSON.stringify({
            ...TEST_QUESTION_PROJECTION,
            choices: [],
          }),
        });
      });
      await beginFixture(t);
      await expect(
        t.mutation(verifyItems, { afterIndex: -1, releaseId: TEST_RELEASE_ID })
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    }
  );
});
