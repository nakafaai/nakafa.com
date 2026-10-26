import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { deactivateCanceledPlan } from "@repo/backend/confect/billing/xendit/cancel";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Duration, Effect, Fiber, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";

const NOW = Date.UTC(2026, 9, 26, 5, 0, 0);
const PERIOD_END = Date.UTC(2026, 10, 26, 5, 0, 0);

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

/** The JSON text of one answer body. */
const encodeJson = Schema.encodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

/** A JSON answer from Xendit with the given status. */
function answer(status: number, body: unknown) {
  return new Response(encodeJson(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

/** A signed-in learner whose Pro plan Xendit bills, active until the end of its paid period. */
async function subscriber() {
  const t = createConvexTestWithBetterAuth();
  const user = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, plan: "pro", suffix: "cancel" })
  );
  const subscriptionId = await t.mutation(async (ctx) => {
    const accountId = await ctx.db.insert("billingAccounts", {
      owner: { kind: "personal", userId: user.userId },
      rail: "xendit",
      country: "ID",
      currency: "IDR",
      providerCustomerId: "cust-1",
    });
    return await ctx.db.insert("billingSubscriptions", {
      accountId,
      offer: "pro.monthly",
      quantity: 1,
      status: "active",
      currentPeriodStart: NOW,
      currentPeriodEnd: PERIOD_END,
      cancelAtPeriodEnd: false,
      provider: {
        kind: "xendit",
        planId: "repl_cancel",
        tokenId: null,
        channel: null,
      },
      providerUpdatedAt: NOW,
    });
  });
  const authed = t.withIdentity({
    sessionId: user.sessionId,
    subject: user.authUserId,
  });
  return { authed, subscriptionId, t };
}

// Fake timers hold the scheduled call to Xendit, so the test only finds it listed.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fetcher.mockReset();
  vi.stubEnv("XENDIT_API_KEY", "test-secret");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("billing/xendit/cancel", () => {
  it("ends a learner's Xendit plan with its paid period and asks Xendit once to turn it off", async () => {
    const { authed, subscriptionId, t } = await subscriber();
    await authed.mutation(api.billing.xendit.cancel.cancelPlan, {});
    await authed.mutation(api.billing.xendit.cancel.cancelPlan, {});
    const rows = await t.run(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      subscription: await ctx.db.get(subscriptionId),
    }));
    expect(rows.subscription).toMatchObject({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: PERIOD_END,
      status: "active",
    });
    expect(rows.jobs).toMatchObject([
      {
        args: [{ planId: "repl_cancel" }],
        name: "billing/xendit/cancel:deactivate",
      },
    ]);
  });

  it("changes nothing for a learner whom Xendit bills no plan", async () => {
    const t = createConvexTestWithBetterAuth();
    const user = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "cancel-none" })
    );
    const authed = t.withIdentity({
      sessionId: user.sessionId,
      subject: user.authUserId,
    });
    expect(
      await authed.mutation(api.billing.xendit.cancel.cancelPlan, {})
    ).toBeNull();
    const jobs = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(jobs).toEqual([]);
  });

  it.effect(
    "turns the plan off, and asks again before it reports a plan Xendit keeps on",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(answer(404, { error_code: "NOT_FOUND" }));
        expect(
          yield* deactivateCanceledPlan("repl_gone").pipe(
            Effect.provideService(FetchHttpClient.Fetch, fetcher)
          )
        ).toBeNull();
        fetcher.mockReset();
        fetcher.mockResolvedValue(answer(500, { error_code: "SERVER_ERROR" }));
        const waiting = yield* deactivateCanceledPlan("repl_on").pipe(
          Effect.provideService(FetchHttpClient.Fetch, fetcher),
          Effect.flip,
          Effect.forkChild
        );
        yield* TestClock.adjust(Duration.minutes(5));
        const error = yield* Fiber.join(waiting);
        expect(error._tag).toBe("XenditDeactivateError");
        expect(fetcher).toHaveBeenCalledTimes(5);
      })
  );
});
