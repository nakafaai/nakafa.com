import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { decodeHistoryRowJson } from "@repo/backend/convex/tryouts/history/decode";
import {
  verifyTerminalFrozenPlacements,
  verifyTerminalProgress,
} from "@repo/backend/convex/tryouts/history/terminalBinding";
import { readIdentities } from "@repo/backend/convex/tryouts/history/terminalState";
import { seedRetainedTryoutHistory } from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("tryouts/history/terminalBinding", () => {
  it("accepts one signed placement shared across retained releases", async () => {
    const target = convexTest(schema, convexModules);
    const verified = await target.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      const [attempts, frozenRows] = await Promise.all([
        ctx.db.query("tryoutAttempts").take(2),
        ctx.db.query("tryoutAttemptPlacements").take(2),
      ]);
      const firstAttempt = attempts[0];
      const secondAttempt = attempts[1];
      if (!(firstAttempt && secondAttempt)) {
        throw new Error("Expected two retained attempt fixtures.");
      }
      const firstFrozen = frozenRows.find(
        ({ tryoutAttemptId }) => tryoutAttemptId === firstAttempt._id
      );
      const secondFrozen = frozenRows.find(
        ({ tryoutAttemptId }) => tryoutAttemptId === secondAttempt._id
      );
      if (!(firstFrozen && secondFrozen)) {
        throw new Error("Expected two retained frozen placement fixtures.");
      }
      const history = await ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_snapshotId_and_rowKind_and_rowHash", (query) =>
          query
            .eq("snapshotId", fixture.plan.snapshotId)
            .eq("rowKind", "placement")
            .eq("rowHash", firstFrozen.placementRowHash)
        )
        .unique();
      if (history?.rowKind !== "placement") {
        throw new Error("Expected one retained placement history fixture.");
      }
      const signed = await runConvexProgram(
        decodeHistoryRowJson(history.rowJson, history.rowHash)
      );
      if (signed.rowKind !== "placement") {
        throw new Error("Expected one signed placement fixture.");
      }

      return runConvexProgram(
        verifyTerminalFrozenPlacements(
          [
            firstAttempt,
            {
              ...firstAttempt,
              _id: secondAttempt._id,
              snapshotReleaseId: secondAttempt.snapshotReleaseId,
            },
          ],
          [
            firstFrozen,
            {
              ...firstFrozen,
              _id: secondFrozen._id,
              tryoutAttemptId: secondAttempt._id,
            },
          ],
          new Map([[firstFrozen.placementIdentity, { history, signed }]]),
          fixture.plan
        )
      );
    });

    expect(verified).toBe(2);
  });

  it("rejects progress that points to an earlier retained attempt", async () => {
    const { attempts, plan, progressRows } = await readProgressFixture();
    const [first, second] = attempts;
    const [progress] = progressRows;
    if (!(first && second && progress)) {
      throw new Error("Expected two retained progress identities.");
    }
    const sameIdentityAttempts = [
      first,
      { ...first, _id: second._id, attemptNumber: 2 },
    ];

    await expectProgressFailure(
      sameIdentityAttempts,
      [{ ...progress, attemptNumber: 1, latestAttemptId: first._id }],
      { ...plan, progressCount: 1 }
    );
  });

  it("rejects duplicate attempt numbers within one progress identity", async () => {
    const { attempts, plan, progressRows } = await readProgressFixture();
    const [first, second] = attempts;
    const [progress] = progressRows;
    if (!(first && second && progress)) {
      throw new Error("Expected two retained progress identities.");
    }

    await expectProgressFailure(
      [first, { ...first, _id: second._id }],
      [progress],
      { ...plan, progressCount: 1 }
    );
  });

  it("rejects an attempt identity with no progress row", async () => {
    const { attempts, plan, progressRows } = await readProgressFixture();
    const [progress] = progressRows;
    if (!progress) {
      throw new Error("Expected retained progress fixture.");
    }

    await expectProgressFailure(attempts, [progress], {
      ...plan,
      progressCount: 1,
    });
  });
});

async function readProgressFixture() {
  const target = convexTest(schema, convexModules);
  const fixture = await target.mutation(seedRetainedTryoutHistory);
  const state = await target.query((ctx) =>
    runConvexProgram(readIdentities(ctx, fixture.plan))
  );
  return { ...state, plan: fixture.plan };
}

async function expectProgressFailure(
  attempts: Parameters<typeof verifyTerminalProgress>[0],
  progressRows: Parameters<typeof verifyTerminalProgress>[1],
  plan: Parameters<typeof verifyTerminalProgress>[2]
) {
  await expect(
    Effect.runPromise(
      verifyTerminalProgress(attempts, progressRows, plan).pipe(Effect.flip)
    )
  ).resolves.toMatchObject({
    _tag: "TryoutHistoryError",
    code: "TRYOUT_HISTORY_INTEGRITY",
  });
}
