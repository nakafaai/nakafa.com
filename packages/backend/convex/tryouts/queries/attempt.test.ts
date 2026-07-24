import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { replaceTryoutSet } from "@repo/backend/test/tryout-runtime";
import {
  seedTryoutStartSet,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-start";
import { describe, expect, it, vi } from "vitest";

const setPublicPath = `try-out/${TRYOUT_START_COUNTRY}/${TRYOUT_START_EXAM}/${TRYOUT_START_TRACK}/${TRYOUT_START_SET}`;
const route = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  sectionKey: TRYOUT_START_SECTION,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};
const startArgs = {
  countryKey: TRYOUT_START_COUNTRY,
  entrySectionKey: TRYOUT_START_SECTION,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};

describe("tryouts/queries/attempt", () => {
  it("retains the frozen attempt after its catalog set row is replaced", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "attempt-catalog-replacement",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        userId: identity.userId,
        visibility: "internal-entry",
      });
      return { fixture, identity };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      startArgs
    );
    await t.mutation((ctx) =>
      replaceTryoutSet(ctx, seeded.fixture.tryoutSetId)
    );

    const [byRoute, byPublicPath] = await Promise.all([
      authed.query(api.tryouts.queries.attempt.getCurrent, route),
      authed.query(api.tryouts.queries.attempt.getCurrentByPublicPath, {
        locale: "id",
        publicPath: setPublicPath,
      }),
    ]);

    expect(byRoute).toMatchObject({
      attemptId: started.attemptId,
      section: { sectionKey: TRYOUT_START_SECTION },
    });
    expect(byPublicPath).toMatchObject({
      attemptId: started.attemptId,
      activeSectionKey: TRYOUT_START_SECTION,
    });
  });
});
