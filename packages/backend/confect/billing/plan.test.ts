import { describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  applyPlanChange,
  type PlanSource,
} from "@repo/backend/confect/billing/plan";
import { PlanSyncIoError } from "@repo/backend/confect/billing/spec";
import {
  createBillingTestConvex,
  exitInMutation,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Array as Arr, Cause, Effect, Exit, Schema } from "effect";

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);

const capture = vi.hoisted(() => vi.fn());
vi.mock("@repo/backend/confect/analytics/capture", () => ({
  captureProductEvent: capture,
}));

/** Inserts one user and returns its decoded document, the shape the plan change reads. */
async function seedUser(t: ReturnType<typeof createBillingTestConvex>) {
  const userId = await t.mutation((ctx) =>
    ctx.db.insert("users", {
      authId: "auth-plan",
      credits: 0,
      creditsResetAt: NOW,
      email: "plan@example.com",
      mascot: MASCOT_CODE,
      name: "Plan",
      plan: "free",
    })
  );
  return t.mutation((ctx) =>
    runInMutation(
      ctx,
      Effect.gen(function* () {
        const reader = yield* DatabaseReader;
        return yield* reader.table("users").get(userId).pipe(Effect.orDie);
      })
    )
  );
}

const pro: PlanSource = { id: "grant_1", productId: "pro", status: "active" };
const expired: PlanSource = {
  id: "expired",
  productId: "pro",
  status: "ended",
};

describe("billing/plan", () => {
  it("upgrades a user to Pro with the purchase credits and records the start", async () => {
    capture.mockReset();
    capture.mockImplementation(() => Effect.void);
    const t = createBillingTestConvex();
    const user = await seedUser(t);
    await t.mutation((ctx) =>
      runInMutation(ctx, applyPlanChange(user, "pro", NOW, pro))
    );
    const stored = await t.run(async (ctx) => ({
      transactions: await ctx.db.query("creditTransactions").collect(),
      user: await ctx.db.get(user._id),
    }));
    expect(stored.user).toMatchObject({ plan: "pro" });
    expect(stored.transactions).toMatchObject([
      {
        type: "purchase",
        metadata: { "grant-id": "grant_1", reason: "plan-upgrade" },
      },
    ]);
    expect(Arr.map(capture.mock.calls, ([input]) => input.event.name)).toEqual([
      "subscription started",
      "plan changed",
    ]);
  });

  it("downgrades a user whose Pro grant ended, and records the cancellation", async () => {
    capture.mockReset();
    capture.mockImplementation(() => Effect.void);
    const t = createBillingTestConvex();
    const user = await seedUser(t);
    await t.mutation((ctx) =>
      runInMutation(ctx, applyPlanChange(user, "free", NOW, expired))
    );
    expect(await t.run(async (ctx) => (await ctx.db.get(user._id))?.plan)).toBe(
      "free"
    );
    expect(Arr.map(capture.mock.calls, ([input]) => input.event.name)).toEqual([
      "subscription canceled",
      "plan changed",
    ]);
  });

  it("downgrades without a cancellation event when the source is still active", async () => {
    capture.mockReset();
    capture.mockImplementation(() => Effect.void);
    const t = createBillingTestConvex();
    const user = await seedUser(t);
    await t.mutation((ctx) =>
      runInMutation(ctx, applyPlanChange(user, "free", NOW, { ...pro }))
    );
    expect(Arr.map(capture.mock.calls, ([input]) => input.event.name)).toEqual([
      "plan changed",
    ]);
  });

  it("reports a failed analytics write as the plan sync failure", async () => {
    capture.mockReset();
    capture.mockImplementation(() => Effect.die(new Error("analytics down")));
    const t = createBillingTestConvex();
    const user = await seedUser(t);
    const failure = await t.mutation(async (ctx) => {
      const exit = await exitInMutation(
        ctx,
        applyPlanChange(user, "pro", NOW, pro)
      );
      return Exit.isFailure(exit) &&
        Schema.is(PlanSyncIoError)(Cause.squash(exit.cause))
        ? "PlanSyncIoError"
        : "none";
    });
    expect(failure).toBe("PlanSyncIoError");
  });
});
