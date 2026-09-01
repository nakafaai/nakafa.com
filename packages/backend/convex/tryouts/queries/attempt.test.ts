import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout/start";

describe("tryouts/queries/attempt", () => {
  it("locks only one exact authenticated in-progress attempt", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "set-lock",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      return user;
    });

    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: TRYOUT_START_COUNTRY,
        destinationSectionKey: TRYOUT_START_SECTION,
        examKey: TRYOUT_START_EXAM,
        locale: "id",
        setKey: TRYOUT_START_SET,
        trackKey: TRYOUT_START_TRACK,
      }
    );

    await expect(
      t.query(api.tryouts.queries.attempt.isLockedByAttemptId, {
        attemptId: started.attemptId,
      })
    ).resolves.toBe(false);
    await expect(
      authed.query(api.tryouts.queries.attempt.isLockedByAttemptId, {
        attemptId: "not-an-id",
      })
    ).resolves.toBe(false);

    await expect(
      authed.query(api.tryouts.queries.attempt.isLockedByAttemptId, {
        attemptId: started.attemptId,
      })
    ).resolves.toBe(true);

    await t.mutation((ctx) =>
      ctx.db.patch(started.attemptId, {
        completedAt: TRYOUT_START_NOW + 1,
        endReason: "submitted",
        status: "completed",
      })
    );

    await expect(
      authed.query(api.tryouts.queries.attempt.isLockedByAttemptId, {
        attemptId: started.attemptId,
      })
    ).resolves.toBe(false);
  });
});
