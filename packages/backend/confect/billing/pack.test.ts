import { beforeEach, describe, expect, it } from "@effect/vitest";
import { accountUnavailableCode } from "@repo/backend/confect/auth/spec";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Array as Arr, Clock, Effect } from "effect";
import { TestClock } from "effect/testing";

const NOW = Date.UTC(2026, 8, 4, 12, 0, 0);

const polarGateway = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  createCustomer: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  findCustomerByEmail: vi.fn(),
  getCustomerByExternalId: vi.fn(),
  updateCustomer: vi.fn(),
}));
vi.mock("@repo/backend/confect/billing/polar/live", () => ({ polarGateway }));

const route = api.billing.sessions;
const request = {
  locale: "de",
  successUrl: "http://localhost:3000/de/settings/billing",
} as const;

const setup = Effect.fn("billing.pack.test.setup")(function* (
  plan: "free" | "pro" = "free"
) {
  const t = createConvexTestWithBetterAuth();
  yield* TestClock.setTime(NOW);
  const now = yield* Clock.currentTimeMillis;
  const user = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now,
        plan,
        suffix: "billing",
      })
    )
  );
  if (plan === "pro") {
    yield* Effect.promise(() =>
      t.mutation((ctx) =>
        ctx.db.insert("billingGrants", {
          product: "pro",
          source: { kind: "contract", contractId: "contract-billing-pro" },
          userId: user.userId,
          validFrom: 0,
          validTo: Date.UTC(2100, 0, 1),
        })
      )
    );
  }
  const customer = {
    email: "billing@example.com",
    externalId: user.authUserId,
    id: "polar-billing",
    name: "User billing",
  };
  polarGateway.getCustomerByExternalId.mockReturnValue(
    Effect.succeed(customer)
  );
  polarGateway.createCustomer.mockReturnValue(Effect.succeed(customer));
  polarGateway.updateCustomer.mockReturnValue(Effect.succeed(customer));
  const authed = t.withIdentity({
    sessionId: user.sessionId,
    subject: user.authUserId,
  });
  return { authed, t, user };
});

describe("billing/pack", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    polarGateway.createCheckoutSession.mockReturnValue(
      Effect.succeed({ url: "https://checkout.example.com/topup" })
    );
  });

  it.effect(
    "refuses a top-up pack to a learner who is not on Pro, before Polar IO",
    () =>
      Effect.gen(function* () {
        const { authed } = yield* setup("free");
        yield* Effect.promise(() =>
          expect(
            authed.action(route.generateTopupCheckoutLink, request)
          ).rejects.toThrow("TOPUP_REQUIRES_PRO")
        );
        expect(polarGateway.getCustomerByExternalId).not.toHaveBeenCalled();
        expect(polarGateway.createCheckoutSession).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "starts a checkout of exactly one top-up pack for a learner on Pro",
    () =>
      Effect.gen(function* () {
        const { authed } = yield* setup("pro");
        const checkout = yield* Effect.promise(() =>
          authed.action(route.generateTopupCheckoutLink, request)
        );
        expect(checkout).toEqual({ url: "https://checkout.example.com/topup" });
        expect(polarGateway.createCheckoutSession).toHaveBeenCalledWith({
          customerId: "polar-billing",
          customerIpAddress: null,
          locale: "de",
          productIds: [polarProductIdFor("pro.topup", "sandbox")],
          successUrl: request.successUrl,
        });
      })
  );

  it.effect(
    "withholds a top-up pack when Pro stops running during Polar IO",
    () =>
      Effect.gen(function* () {
        const { authed, t, user } = yield* setup("pro");
        polarGateway.createCheckoutSession.mockReturnValue(
          Effect.gen(function* () {
            yield* Effect.promise(() =>
              t.mutation(async (ctx) => {
                const grants = await ctx.db
                  .query("billingGrants")
                  .withIndex("by_userId_and_validTo", (query) =>
                    query.eq("userId", user.userId)
                  )
                  .collect();
                await Promise.all(
                  Arr.map(grants, (grant) => ctx.db.delete(grant._id))
                );
              })
            );
            return { url: "https://checkout.example.com/topup" };
          })
        );
        yield* Effect.promise(() =>
          expect(
            authed.action(route.generateTopupCheckoutLink, request)
          ).rejects.toThrow(accountUnavailableCode)
        );
      })
  );
});
