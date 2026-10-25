import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import {
  insertPolarAccount,
  insertProSubscription,
} from "@repo/backend/test/billing";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import type { FunctionArgs } from "convex/server";

const startAccessArgs: FunctionArgs<
  typeof api.tryouts.queries.access.getStartAccess
> = {
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "id",
  now: TRYOUT_TEST_NOW,
  setKey: "set-1",
  trackKey: "2027",
};

describe("tryouts/queries/access", () => {
  it("shows free access to anonymous and free accounts", async () => {
    const t = createConvexTestWithBetterAuth();

    expect(
      await t.query(api.tryouts.queries.access.getStartAccess, startAccessArgs)
    ).toEqual({ kind: "free-attempt" });

    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "start-access-free",
      })
    );
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getStartAccess,
        startAccessArgs
      )
    ).toEqual({ kind: "free-attempt" });
  });

  it("shows included subscription access without restricting free starts", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "start-access-included",
      });
      const accountId = await insertPolarAccount(ctx, seeded.userId);
      await insertProSubscription(ctx, accountId, { currentPeriodEnd: null });
      return seeded;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    expect(
      await authed.query(
        api.tryouts.queries.access.getStartAccess,
        startAccessArgs
      )
    ).toEqual({ kind: "included" });
  });
});
