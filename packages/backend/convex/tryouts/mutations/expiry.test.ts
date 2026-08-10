import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  insertTryoutAttempt,
  insertTryoutAttemptPlacement,
  insertTryoutSectionAttempt,
  insertTryoutUser,
  seedTryoutContentAccessState,
} from "@repo/backend/test/tryout-runtime";
import { makeTryoutSet } from "@repo/backend/test/tryouts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
const EXPIRED_AT = NOW - 60_000;
const ACTIVE_EXPIRES_AT = NOW + 3_600_000;
const STALE_EXPIRES_AT = EXPIRED_AT - 60_000;
const ATTEMPT_EXPIRY_NAME = "tryouts/mutations/expiry:attempt";
const SECTION_EXPIRY_NAME = "tryouts/mutations/expiry:section";
const ATTEMPT_RECONCILIATION_NAME =
  "tryouts/mutations/expiry:reconcileAttempts";
const SECTION_RECONCILIATION_NAME =
  "tryouts/mutations/expiry:reconcileSections";

describe("tryouts/mutations/expiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("queues isolated attempt and section expiry jobs idempotently", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(async (ctx) => {
      const expired = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "expiry-sweep-attempt",
      });
      await ctx.db.patch(expired.attemptId, {
        expiresAt: EXPIRED_AT,
        scoreStatus: "official",
        scoringStrategy: "raw",
      });
      await ctx.db.patch(expired.sectionAttemptId, {
        expiresAt: EXPIRED_AT,
      });

      const expiredAttempt = await ctx.db.get(expired.attemptId);
      if (!expiredAttempt) {
        throw new Error("Expected the expired attempt fixture.");
      }

      const activeUserId = await insertTryoutUser(ctx, {
        authId: "auth-expiry-sweep-section",
        email: "expiry-sweep-section@example.com",
        name: "Expiry Sweep Section",
      });
      const activeAttemptId = await insertTryoutAttempt(ctx, {
        expiresAt: ACTIVE_EXPIRES_AT,
        scoringStrategy: "raw",
        sectionSnapshots: expiredAttempt.sectionSnapshots,
        set: makeTryoutSet(),
        snapshotId: expiredAttempt.tryoutSnapshotId,
        snapshotReleaseId: expiredAttempt.snapshotReleaseId,
        userId: activeUserId,
      });
      const expiredPlacement = await ctx.db.get(expired.placementId);
      if (!expiredPlacement) {
        throw new Error("Expected the expired placement fixture.");
      }
      await insertTryoutAttemptPlacement(ctx, {
        placement: expiredPlacement,
        tryoutAttemptId: activeAttemptId,
      });
      const expiredSectionId = await insertTryoutSectionAttempt(ctx, {
        expiresAt: EXPIRED_AT,
        tryoutAttemptId: activeAttemptId,
      });

      return {
        activeAttemptId,
        expiredAttemptId: expired.attemptId,
        expiredAttemptSectionId: expired.sectionAttemptId,
        expiredSectionId,
      };
    });

    await t.mutation(internal.tryouts.mutations.expiry.sweep, {});
    await t.mutation(internal.tryouts.mutations.expiry.sweep, {});

    const beforeDrain = await t.query(async (ctx) => {
      const scheduledJobs = await ctx.db.system
        .query("_scheduled_functions")
        .collect();

      return {
        activeAttempt: await ctx.db.get(fixture.activeAttemptId),
        expiredAttempt: await ctx.db.get(fixture.expiredAttemptId),
        expiredAttemptSection: await ctx.db.get(
          fixture.expiredAttemptSectionId
        ),
        expiredSection: await ctx.db.get(fixture.expiredSectionId),
        expiryJobs: scheduledJobs.filter(({ name }) =>
          name.startsWith("tryouts/mutations/expiry:")
        ),
        scores: await ctx.db.query("tryoutScores").collect(),
      };
    });

    const expectedAttemptReconciliation = {
      args: [{ before: NOW }],
      name: ATTEMPT_RECONCILIATION_NAME,
      state: { kind: "pending" },
    };

    expect(
      beforeDrain.expiryJobs.map(({ args, name, state }) => ({
        args,
        name,
        state,
      }))
    ).toEqual([expectedAttemptReconciliation, expectedAttemptReconciliation]);
    expect(beforeDrain).toMatchObject({
      activeAttempt: { status: "in-progress" },
      expiredAttempt: { status: "in-progress" },
      expiredAttemptSection: { status: "in-progress" },
      expiredSection: { status: "in-progress" },
      scores: [],
    });

    vi.runOnlyPendingTimers();
    await t.finishInProgressScheduledFunctions();

    const afterAttemptPhase = await t.query(async (ctx) => {
      const scheduledJobs = await ctx.db.system
        .query("_scheduled_functions")
        .collect();

      return {
        activeAttempt: await ctx.db.get(fixture.activeAttemptId),
        attemptExpiryJobs: scheduledJobs.filter(
          ({ name }) => name === ATTEMPT_EXPIRY_NAME
        ),
        attemptReconciliationJobs: scheduledJobs.filter(
          ({ name }) => name === ATTEMPT_RECONCILIATION_NAME
        ),
        expiredAttempt: await ctx.db.get(fixture.expiredAttemptId),
        scores: await ctx.db.query("tryoutScores").collect(),
        sectionExpiryJobs: scheduledJobs.filter(
          ({ name }) => name === SECTION_EXPIRY_NAME
        ),
        sectionReconciliationJobs: scheduledJobs.filter(
          ({ name }) => name === SECTION_RECONCILIATION_NAME
        ),
      };
    });

    expect(afterAttemptPhase).toMatchObject({
      activeAttempt: { status: "in-progress" },
      expiredAttempt: { status: "in-progress" },
      scores: [],
      sectionExpiryJobs: [],
    });
    expect(afterAttemptPhase.attemptReconciliationJobs).toHaveLength(2);
    expect(
      afterAttemptPhase.attemptReconciliationJobs.every(
        ({ state }) => state.kind === "success"
      )
    ).toBe(true);
    expect(
      afterAttemptPhase.attemptExpiryJobs.map(({ args, state }) => ({
        args,
        state,
      }))
    ).toEqual(
      Array.from({ length: 2 }, () => ({
        args: [
          {
            attemptId: fixture.expiredAttemptId,
            expiresAt: EXPIRED_AT,
          },
        ],
        state: { kind: "pending" },
      }))
    );
    expect(
      afterAttemptPhase.sectionReconciliationJobs.map(({ args, state }) => ({
        args,
        state,
      }))
    ).toEqual(
      Array.from({ length: 2 }, () => ({
        args: [
          {
            before: NOW,
            scheduledAttemptIds: [fixture.expiredAttemptId],
          },
        ],
        state: { kind: "pending" },
      }))
    );

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const afterDrain = await t.query(async (ctx) => {
      const scheduledJobs = await ctx.db.system
        .query("_scheduled_functions")
        .collect();

      return {
        activeAttempt: await ctx.db.get(fixture.activeAttemptId),
        activeAttemptScore: await ctx.db
          .query("tryoutScores")
          .withIndex("by_tryoutAttemptId", (query) =>
            query.eq("tryoutAttemptId", fixture.activeAttemptId)
          )
          .unique(),
        expiredAttempt: await ctx.db.get(fixture.expiredAttemptId),
        expiredAttemptScore: await ctx.db
          .query("tryoutScores")
          .withIndex("by_tryoutAttemptId", (query) =>
            query.eq("tryoutAttemptId", fixture.expiredAttemptId)
          )
          .unique(),
        expiredAttemptSection: await ctx.db.get(
          fixture.expiredAttemptSectionId
        ),
        expiredSection: await ctx.db.get(fixture.expiredSectionId),
        expiryJobs: scheduledJobs.filter(({ name }) =>
          name.startsWith("tryouts/mutations/expiry:")
        ),
        scores: await ctx.db.query("tryoutScores").collect(),
      };
    });

    expect(afterDrain).toMatchObject({
      activeAttempt: {
        endReason: "submitted",
        status: "completed",
      },
      activeAttemptScore: {
        rawScore: 0,
        scoringStrategy: "raw",
      },
      expiredAttempt: {
        endReason: "time-expired",
        status: "expired",
      },
      expiredAttemptScore: {
        rawScore: 0,
        scoringStrategy: "raw",
      },
      expiredAttemptSection: {
        endReason: "time-expired",
        status: "expired",
      },
      expiredSection: {
        endReason: "time-expired",
        status: "expired",
      },
    });
    expect(afterDrain.scores).toHaveLength(2);
    expect(
      afterDrain.expiryJobs.every(({ state }) => state.kind === "success")
    ).toBe(true);

    const attemptReconciliationJobs = afterDrain.expiryJobs.filter(
      ({ name }) => name === ATTEMPT_RECONCILIATION_NAME
    );
    const sectionReconciliationJobs = afterDrain.expiryJobs.filter(
      ({ name }) => name === SECTION_RECONCILIATION_NAME
    );
    const attemptExpiryJobs = afterDrain.expiryJobs.filter(
      ({ name }) => name === ATTEMPT_EXPIRY_NAME
    );
    const sectionExpiryJobs = afterDrain.expiryJobs.filter(
      ({ name }) => name === SECTION_EXPIRY_NAME
    );

    expect(attemptReconciliationJobs).toHaveLength(2);
    expect(sectionReconciliationJobs).toHaveLength(2);
    expect(attemptExpiryJobs).toHaveLength(2);
    expect(attemptExpiryJobs.map(({ args }) => args)).toEqual(
      Array.from({ length: attemptExpiryJobs.length }, () => [
        {
          attemptId: fixture.expiredAttemptId,
          expiresAt: EXPIRED_AT,
        },
      ])
    );
    expect(sectionExpiryJobs).toHaveLength(2);
    expect(sectionExpiryJobs.map(({ args }) => args)).toEqual(
      Array.from({ length: sectionExpiryJobs.length }, () => [
        {
          expiresAt: EXPIRED_AT,
          sectionAttemptId: fixture.expiredSectionId,
        },
      ])
    );
  });

  it("ignores stale attempt and section expiry jobs", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(async (ctx) => {
      const seeded = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "expiry-stale-deadline",
      });
      await ctx.db.patch(seeded.attemptId, {
        expiresAt: EXPIRED_AT,
        scoreStatus: "official",
        scoringStrategy: "raw",
      });
      await ctx.db.patch(seeded.sectionAttemptId, {
        expiresAt: EXPIRED_AT,
      });
      return seeded;
    });

    await t.mutation(internal.tryouts.mutations.expiry.attempt, {
      attemptId: fixture.attemptId,
      expiresAt: STALE_EXPIRES_AT,
    });
    await t.mutation(internal.tryouts.mutations.expiry.section, {
      expiresAt: STALE_EXPIRES_AT,
      sectionAttemptId: fixture.sectionAttemptId,
    });

    const state = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(fixture.attemptId),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      scores: await ctx.db.query("tryoutScores").collect(),
      section: await ctx.db.get(fixture.sectionAttemptId),
    }));

    expect(state).toMatchObject({
      attempt: {
        expiresAt: EXPIRED_AT,
        status: "in-progress",
      },
      scheduledJobs: [],
      scores: [],
      section: {
        expiresAt: EXPIRED_AT,
        status: "in-progress",
      },
    });
  });
});
