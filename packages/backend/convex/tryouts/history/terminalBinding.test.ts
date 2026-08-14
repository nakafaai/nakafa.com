import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { verifyTerminalProgress } from "@repo/backend/convex/tryouts/history/terminalBinding";
import { readIdentities } from "@repo/backend/convex/tryouts/history/terminalState";
import {
  prepareRetainedTryoutHistory,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("tryouts/history/terminalBinding", () => {
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
  const fixture = await target.mutation(async (ctx) => {
    const seeded = await seedRetainedTryoutHistory(ctx);
    await prepareRetainedTryoutHistory(ctx, seeded);
    return seeded;
  });
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
