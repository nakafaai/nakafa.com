import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { requireActiveReadyTryoutSet } from "@repo/backend/convex/tryouts/read";
import {
  seedTryoutStartSet,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-start";
import { describe, expect, it } from "vitest";

const setIdentity = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id" as const,
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};

describe("tryouts/read", () => {
  it.each([
    ["set", { isReady: false }],
    ["parent track", { trackIsReady: false }],
  ] as const)("rejects a ready lookup when the %s is not ready", async (_, readiness) => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.mutation(async (ctx) => {
        const user = await seedAuthenticatedUser(ctx, {
          now: TRYOUT_START_NOW,
          suffix: `tryout-unready-${_}`,
        });
        await seedTryoutStartSet(ctx, {
          ...readiness,
          userId: user.userId,
          visibility: "visible",
        });

        return await requireActiveReadyTryoutSet(ctx, setIdentity);
      })
    ).rejects.toThrow("TRYOUT_SET_NOT_READY");
  });
});
