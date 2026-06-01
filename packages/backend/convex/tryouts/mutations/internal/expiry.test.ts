import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { tryoutExpirySweepBatchSize } from "@repo/backend/convex/tryouts/expiry/spec";
import {
  createTryoutTestConvex,
  insertTryoutSkeleton,
} from "@repo/backend/convex/tryouts/test.helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

interface ExpiryTestBase {
  scaleVersionId: Id<"irtScaleVersions">;
  setId: Id<"exerciseSets">;
  tryoutId: Id<"tryouts">;
  userId: Id<"users">;
}

/** Inserts shared rows needed to create overdue tryout attempts. */
async function insertExpiryTestBase(ctx: MutationCtx, suffix: string) {
  const identity = await seedAuthenticatedUser(ctx, {
    now: NOW,
    suffix,
  });
  const tryout = await insertTryoutSkeleton(ctx, suffix, 1);

  return {
    scaleVersionId: tryout.scaleVersionId,
    setId: tryout.setId,
    tryoutId: tryout.tryoutId,
    userId: identity.userId,
  };
}

/** Inserts one in-progress tryout attempt with a controllable expiry time. */
async function insertTryoutAttempt(
  ctx: MutationCtx,
  base: ExpiryTestBase,
  {
    attemptNumber,
    expiresAt,
  }: {
    attemptNumber: number;
    expiresAt: number;
  }
) {
  return await ctx.db.insert("tryoutAttempts", {
    userId: base.userId,
    tryoutId: base.tryoutId,
    scaleVersionId: base.scaleVersionId,
    scoreStatus: "official",
    status: "in-progress",
    partSetSnapshots: [
      {
        partIndex: 0,
        partKey: "quantitative-knowledge",
        questionCount: 1,
        setId: base.setId,
      },
    ],
    completedPartIndices: [],
    attemptNumber,
    totalCorrect: 0,
    totalQuestions: 0,
    theta: 0,
    thetaSE: 1,
    startedAt: expiresAt - 1000,
    expiresAt,
    lastActivityAt: expiresAt - 1,
    completedAt: null,
    endReason: null,
  });
}

describe("tryouts/mutations/internal/expiry", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules overdue attempts without expiring them inside the sweep transaction", async () => {
    const t = createTryoutTestConvex();

    const { overdueAttemptId, futureAttemptId } = await t.mutation(
      async (ctx) => {
        const base = await insertExpiryTestBase(ctx, "expiry-sweep");
        const overdueAttemptId = await insertTryoutAttempt(ctx, base, {
          attemptNumber: 1,
          expiresAt: NOW - 1,
        });
        const futureAttemptId = await insertTryoutAttempt(ctx, base, {
          attemptNumber: 2,
          expiresAt: NOW + 60_000,
        });

        return { futureAttemptId, overdueAttemptId };
      }
    );

    const result = await t.mutation(
      internal.tryouts.mutations.internal.expiry.sweepExpiredTryoutAttempts,
      {}
    );
    const state = await t.query(async (ctx) => ({
      futureAttempt: await ctx.db.get("tryoutAttempts", futureAttemptId),
      overdueAttempt: await ctx.db.get("tryoutAttempts", overdueAttemptId),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
    }));

    expect(result).toBeNull();
    expect(state.overdueAttempt?.status).toBe("in-progress");
    expect(state.futureAttempt?.status).toBe("in-progress");
    expect(state.scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          {
            expiresAtMs: NOW - 1,
            tryoutAttemptId: overdueAttemptId,
          },
        ],
        name: expect.stringContaining("expireTryoutAttemptInternal"),
      }),
    ]);
  });

  it("does not immediately reschedule the same overdue page", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(async (ctx) => {
      const base = await insertExpiryTestBase(ctx, "expiry-sweep-full");

      for (let index = 0; index < tryoutExpirySweepBatchSize; index += 1) {
        await insertTryoutAttempt(ctx, base, {
          attemptNumber: index + 1,
          expiresAt: NOW - index - 1,
        });
      }
    });

    await t.mutation(
      internal.tryouts.mutations.internal.expiry.sweepExpiredTryoutAttempts,
      {}
    );

    const scheduledJobs = await t.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );
    const expiryJobs = scheduledJobs.filter((job) =>
      job.name.includes("expireTryoutAttemptInternal")
    );

    expect(expiryJobs).toHaveLength(tryoutExpirySweepBatchSize);
    expect(
      scheduledJobs.some((job) =>
        job.name.includes("sweepExpiredTryoutAttempts")
      )
    ).toBe(false);
  });
});
