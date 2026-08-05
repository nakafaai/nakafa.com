import { api } from "@repo/backend/convex/_generated/api";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { loadTryoutStartSource } from "@repo/backend/convex/tryouts/start/source";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import {
  activateRenamedTryoutStartSource,
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_SET as SET,
  TRYOUT_START_TRACK as TRACK,
  TRYOUT_RENAMED_SET_PATH,
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import { describe, expect, it, vi } from "vitest";

const startArgs: StartAttemptArgs = {
  countryKey: COUNTRY,
  examKey: EXAM,
  locale: "id",
  setKey: SET,
  trackKey: TRACK,
};
describe("tryouts/start/source", () => {
  it("starts from signed rows after filesystem ownership is removed", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    await t.mutation((ctx) => activateTryoutStartSource(ctx, "visible", "raw"));
    const source = await t.query((ctx) =>
      runConvexProgram(loadTryoutStartSource(ctx, startArgs))
    );

    expect(source).toMatchObject({
      snapshot: {
        setIdentity: expect.any(String),
        snapshotId: expect.any(String),
      },
    });
  });

  it("resumes one logical set after its public path changes", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-renamed-set",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: seeded.sessionId,
      subject: seeded.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      startArgs
    );

    await t.mutation(activateRenamedTryoutStartSource);

    await expect(
      authed.query(api.tryouts.queries.attempt.getCurrentByPublicPath, {
        locale: "id",
        publicPath: TRYOUT_RENAMED_SET_PATH,
      })
    ).resolves.toMatchObject({ attemptId: started.attemptId });
  });
});
