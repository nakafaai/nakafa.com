import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { XenditRequestFailed } from "@repo/backend/confect/billing/xendit/client";
import { createPlan } from "@repo/backend/confect/billing/xendit/plans";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  createBillingTestConvex,
  seedXenditSubscription,
} from "@repo/backend/test/billing";
import { Effect } from "effect";

vi.mock(
  "@repo/backend/confect/billing/xendit/plans",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/confect/billing/xendit/plans")
    >()),
    createPlan: vi.fn(),
  })
);

const NOW = Date.UTC(2026, 9, 26, 5, 0, 0);
const PERIOD_END = Date.UTC(2026, 10, 26, 5, 0, 0);
const steps = internal.billing.xendit.renewal;

/** The plan Xendit answers once it opened one on the saved channel. */
const OPENED = {
  amount: 79_000,
  created: "2026-10-26T05:00:00Z",
  currency: "IDR",
  customer_id: "cust-1",
  id: "repl_opened",
  recurring_cycle_count: 0,
  reference_id: "subscription-1",
  status: "ACTIVE" as const,
  updated: "2026-10-26T05:00:00Z",
};

/** A learner whose first month is paid: an active subscription with a saved channel and no plan yet. */
async function paidFirstMonth(
  changes: {
    readonly canceled?: boolean;
    readonly tokenId?: string | null;
  } = {}
) {
  const t = createBillingTestConvex();
  const subscriptionId = await t.run(async (ctx) => {
    const seeded = await seedXenditSubscription(ctx);
    await ctx.db.patch(seeded.accountId, { providerCustomerId: "cust-1" });
    await ctx.db.patch(seeded.subscriptionId, {
      cancelAtPeriodEnd: changes.canceled ?? false,
      currentPeriodEnd: PERIOD_END,
      currentPeriodStart: NOW,
      provider: {
        kind: "xendit",
        planId: null,
        tokenId: changes.tokenId === undefined ? "pt-1" : changes.tokenId,
        channel: null,
      },
      status: "active",
    });
    return seeded.subscriptionId;
  });
  return { subscriptionId, t };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("XENDIT_API_KEY", "test-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("billing/xendit/renewal", () => {
  it("opens the plan of a paid first month on its saved channel and names it once", async () => {
    vi.mocked(createPlan).mockReturnValue(Effect.succeed(OPENED));
    const { subscriptionId, t } = await paidFirstMonth();
    await t.action(steps.open, { locale: "id", subscriptionId });
    await t.action(steps.open, { locale: "id", subscriptionId });
    expect(createPlan).toHaveBeenCalledOnce();
    expect(vi.mocked(createPlan).mock.calls[0]?.[0]).toMatchObject({
      amount: 79_000,
      customer_id: "cust-1",
      payment_tokens: [{ payment_token_id: "pt-1", rank: 1 }],
      reference_id: subscriptionId,
    });
    const subscription = await t.run((ctx) => ctx.db.get(subscriptionId));
    expect(subscription?.provider).toMatchObject({
      kind: "xendit",
      planId: "repl_opened",
      tokenId: "pt-1",
    });
    expect(
      await t.mutation(steps.record, { planId: "repl_other", subscriptionId })
    ).toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.get(subscriptionId)))?.provider
    ).toMatchObject({ planId: "repl_opened" });
  });

  it("opens no plan for a subscription canceled before it opened, without a saved channel, without a Xendit customer, or gone", async () => {
    const canceled = await paidFirstMonth({ canceled: true });
    expect(
      await canceled.t.query(steps.read, {
        subscriptionId: canceled.subscriptionId,
      })
    ).toBeNull();
    const unsaved = await paidFirstMonth({ tokenId: null });
    expect(
      await unsaved.t.query(steps.read, {
        subscriptionId: unsaved.subscriptionId,
      })
    ).toBeNull();
    const customerless = await paidFirstMonth();
    await customerless.t.run(async (ctx) => {
      const subscription = await ctx.db.get(customerless.subscriptionId);
      if (subscription) {
        await ctx.db.patch(subscription.accountId, {
          providerCustomerId: null,
        });
      }
    });
    expect(
      await customerless.t.query(steps.read, {
        subscriptionId: customerless.subscriptionId,
      })
    ).toBeNull();
    const gone = await paidFirstMonth();
    await gone.t.run((ctx) => ctx.db.delete(gone.subscriptionId));
    await gone.t.action(steps.open, {
      locale: "en",
      subscriptionId: gone.subscriptionId,
    });
    expect(
      await gone.t.mutation(steps.record, {
        planId: "repl_gone",
        subscriptionId: gone.subscriptionId,
      })
    ).toBeNull();
    expect(createPlan).not.toHaveBeenCalled();
  });

  it("asks Xendit again after a failure on its side, and reports a refused plan without asking again", async () => {
    // A retry runs the request again, so each mocked request counts its own attempts.
    let attempts = 0;
    vi.mocked(createPlan).mockReturnValue(
      Effect.suspend(() => {
        attempts += 1;
        return attempts === 1
          ? Effect.fail(
              new XenditRequestFailed({
                errorCode: "SERVER_ERROR",
                message: "Xendit failed.",
                status: 500,
              })
            )
          : Effect.succeed(OPENED);
      })
    );
    const retried = await paidFirstMonth();
    await retried.t.action(steps.open, {
      locale: "id",
      subscriptionId: retried.subscriptionId,
    });
    expect(attempts).toBe(2);
    let refusals = 0;
    vi.mocked(createPlan).mockReturnValue(
      Effect.suspend(() => {
        refusals += 1;
        return Effect.fail(
          new XenditRequestFailed({
            errorCode: "INVALID_PAYMENT_TOKEN",
            message: "The token cannot be charged.",
            status: 400,
          })
        );
      })
    );
    const refused = await paidFirstMonth();
    await expect(
      refused.t.action(steps.open, {
        locale: "id",
        subscriptionId: refused.subscriptionId,
      })
    ).rejects.toThrow();
    expect(refusals).toBe(1);
  }, 30_000);
});
