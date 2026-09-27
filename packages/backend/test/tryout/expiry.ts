import { assert } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  insertTryoutAttempt,
  insertTryoutAttemptPlacement,
  insertTryoutSectionAttempt,
  insertTryoutUser,
  seedTryoutContentAccessState,
} from "@repo/backend/test/tryout/runtime";
import { makeTryoutSet } from "@repo/backend/test/tryouts";
/** Seeds an active attempt and section whose scheduler deadlines have elapsed. */
export async function seedExpiredTryout(
  ctx: MutationCtx,
  suffix: string,
  expiresAt: number
) {
  const fixture = await seedTryoutContentAccessState(ctx, {
    attemptStatus: "in-progress",
    sectionStatus: "in-progress",
    suffix,
  });
  await ctx.db.patch(fixture.attemptId, { expiresAt });
  await ctx.db.patch(fixture.sectionAttemptId, { expiresAt });
  return fixture;
}

/** Seeds independent expired attempt and section deadlines for sweep recovery. */
export async function seedExpirySweep(
  ctx: MutationCtx,
  expiredAt: number,
  activeExpiresAt: number
) {
  const expired = await seedTryoutContentAccessState(ctx, {
    attemptStatus: "in-progress",
    sectionStatus: "in-progress",
    suffix: "expiry-sweep-attempt",
  });
  await ctx.db.patch(expired.attemptId, {
    expiresAt: expiredAt,
    scoreStatus: "official",
    scoringStrategy: "raw",
  });
  await ctx.db.patch(expired.sectionAttemptId, {
    expiresAt: expiredAt,
  });
  const expiredAttempt = await ctx.db.get(expired.attemptId);
  assert.isNotNull(expiredAttempt);
  const activeUserId = await insertTryoutUser(ctx, {
    authId: "auth-expiry-sweep-section",
    email: "expiry-sweep-section@example.com",
    name: "Expiry Sweep Section",
  });
  const activeAttemptId = await insertTryoutAttempt(ctx, {
    expiresAt: activeExpiresAt,
    scoringStrategy: "raw",
    sectionSnapshots: expiredAttempt.sectionSnapshots,
    set: makeTryoutSet(),
    snapshotId: expiredAttempt.tryoutSnapshotId,
    snapshotReleaseId: expiredAttempt.snapshotReleaseId,
    userId: activeUserId,
  });
  const expiredPlacement = await ctx.db.get(expired.placementId);
  assert.isNotNull(expiredPlacement);
  await insertTryoutAttemptPlacement(ctx, {
    placement: expiredPlacement,
    tryoutAttemptId: activeAttemptId,
  });
  const expiredSectionId = await insertTryoutSectionAttempt(ctx, {
    expiresAt: expiredAt,
    tryoutAttemptId: activeAttemptId,
  });
  return {
    activeAttemptId,
    expiredAttemptId: expired.attemptId,
    expiredAttemptSectionId: expired.sectionAttemptId,
    expiredSectionId,
  };
}
