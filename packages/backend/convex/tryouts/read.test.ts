import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { requireActiveReadyTryoutSet } from "@repo/backend/convex/tryouts/read";
import {
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import { describe, expect, it } from "vitest";

const setIdentity: Parameters<typeof requireActiveReadyTryoutSet>[1] = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id",
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};

describe("tryouts/read", () => {
  it.each([
    { label: "set", readiness: { isReady: false } },
    { label: "parent track", readiness: { trackIsReady: false } },
  ])(
    "rejects a ready lookup when the $label is not ready",
    async ({ label, readiness }) => {
      const t = createConvexTestWithBetterAuth();

      await expect(
        t.mutation(async (ctx) => {
          const user = await seedAuthenticatedUser(ctx, {
            now: TRYOUT_START_NOW,
            suffix: `tryout-unready-${label}`,
          });
          await seedTryoutStartSet(ctx, {
            ...readiness,
            userId: user.userId,
            visibility: "visible",
          });

          return await requireActiveReadyTryoutSet(ctx, setIdentity);
        })
      ).rejects.toThrow("TRYOUT_SET_NOT_READY");
    }
  );
});
