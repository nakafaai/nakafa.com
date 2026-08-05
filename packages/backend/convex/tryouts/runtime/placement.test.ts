import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createAttemptPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import {
  insertTryoutAttempt,
  insertTryoutUser,
  tryoutSectionSnapshot,
} from "@repo/backend/test/tryout-runtime";
import {
  makeSignedTryoutSection,
  makeSignedTryoutSource,
  TRYOUT_TEST_CONTENT_HASH,
} from "@repo/backend/test/tryout-section";
import { makeTryoutSection, makeTryoutSet } from "@repo/backend/test/tryouts";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const TRACK = "2027";
const SECTION = "penalaran-matematika";
const SOURCE = `question-bank/tryout/indonesia/snbt/${SECTION}/set-1`;
const SET_ROUTE = `try-out/indonesia/snbt/${TRACK}/set-1`;
const ROUTE = `${SET_ROUTE}/${SECTION}`;

/** Inserts one attempt backed entirely by a signed source fixture. */
async function insertRuntime(ctx: Parameters<typeof insertTryoutUser>[0]) {
  const userId = await insertTryoutUser(ctx, {
    authId: "auth-placement",
    email: "placement@example.com",
    name: "Placement",
  });
  const set = makeTryoutSet({ publicPath: SET_ROUTE });
  const section = makeTryoutSection({
    publicPath: ROUTE,
    questionSourcePath: `packages/corpus/${SOURCE}`,
  });
  const signedSection = makeSignedTryoutSection(section, {
    sourceRevision: "2027",
  });
  const source = makeSignedTryoutSource(set, [signedSection]);
  const attemptId = await insertTryoutAttempt(ctx, {
    sectionSnapshots: [tryoutSectionSnapshot(signedSection)],
    set,
    snapshotId: source.snapshot.snapshotId,
    snapshotReleaseId: source.bundle.releaseId,
    userId,
  });
  const attempt = await ctx.db.get(attemptId);

  if (!attempt) {
    throw new Error("Expected one signed attempt fixture.");
  }

  return { attempt, source };
}

describe("tryouts/runtime/placement", () => {
  it("freezes the exact signed placement facts", async () => {
    const t = convexTest(schema, convexModules);

    const placement = await t.mutation(async (ctx) => {
      const runtime = await insertRuntime(ctx);

      await runConvexProgram(createAttemptPlacements(ctx, runtime));
      return await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex(
          "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
          (query) =>
            query
              .eq("tryoutAttemptId", runtime.attempt._id)
              .eq("sectionKey", SECTION)
        )
        .unique();
    });

    expect(placement).toMatchObject({
      contentHash: TRYOUT_TEST_CONTENT_HASH,
      sourceRevision: "2027",
    });
    expect(placement).not.toHaveProperty("questionId");
  });

  it("rejects an incomplete signed placement snapshot", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const runtime = await insertRuntime(ctx);
        const section = runtime.source.snapshot.sections[0];
        if (!section) {
          throw new Error("Expected one signed section fixture.");
        }

        await runConvexProgram(
          createAttemptPlacements(ctx, {
            attempt: runtime.attempt,
            source: {
              ...runtime.source,
              snapshot: {
                ...runtime.source.snapshot,
                sections: [{ ...section, placements: [] }],
              },
            },
          })
        );
      })
    ).rejects.toThrow("TRYOUT_SECTION_SNAPSHOT_MISMATCH");
  });
});
