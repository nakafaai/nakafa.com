import { beforeEach, describe, expect, it } from "@effect/vitest";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import {
  PolarCheckoutError,
  polarCheckoutErrorCode,
} from "@repo/backend/confect/billing/polar/spec";
import {
  checkoutOfferUnavailableCode,
  proAlreadyHeldCode,
} from "@repo/backend/confect/billing/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Clock, Effect } from "effect";
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
  currency: "EUR",
  locale: "de",
  offer: "pro.monthly",
  successUrl: "http://localhost:3000/de/settings/billing",
} as const;

const setup = Effect.fn("billing.pro.test.setup")(function* (
  emailVerified = true
) {
  const t = createConvexTestWithBetterAuth();
  yield* TestClock.setTime(NOW);
  const now = yield* Clock.currentTimeMillis;
  const user = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        emailVerified,
        now,
        suffix: "billing",
      })
    )
  );
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

describe("billing/pro", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    polarGateway.createCheckoutSession.mockReturnValue(
      Effect.succeed({ url: "https://checkout.example.com/session" })
    );
    polarGateway.createCustomerPortalSession.mockReturnValue(
      Effect.succeed({ url: "https://portal.example.com/session" })
    );
  });

  it.effect.each([null, "192.0.2.1"])(
    "creates an owned checkout with request IP %s",
    (ip) =>
      Effect.gen(function* () {
        const { authed } = yield* setup();
        const checkout = yield* Effect.promise(() =>
          authed
            .withRequestMetadata({ ip })
            .action(route.generateCheckoutLink, request)
        );
        expect(checkout).toEqual({
          url: "https://checkout.example.com/session",
        });
        expect(polarGateway.createCheckoutSession).toHaveBeenCalledWith({
          customerId: "polar-billing",
          customerIpAddress: ip,
          locale: "de",
          productIds: [
            polarProductIdFor("pro.monthly", "sandbox"),
            polarProductIdFor("pro.yearly", "sandbox"),
          ],
          successUrl: request.successUrl,
        });
      })
  );

  it.effect(
    "returns to the staging site when staging shares the deployment, and refuses it otherwise",
    () =>
      Effect.gen(function* () {
        const { authed } = yield* setup();
        const staging = {
          ...request,
          successUrl: "https://staging.nakafa.com/de/settings/billing",
        };
        yield* Effect.promise(() =>
          expect(
            authed.action(route.generateCheckoutLink, staging)
          ).rejects.toThrow("INVALID_CHECKOUT_SUCCESS_URL")
        );
        vi.stubEnv("STAGING_SITE_URL", "https://staging.nakafa.com");
        yield* Effect.promise(() =>
          authed.action(route.generateCheckoutLink, staging)
        );
        expect(polarGateway.createCheckoutSession).toHaveBeenCalledWith(
          expect.objectContaining({ successUrl: staging.successUrl })
        );
      }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())))
  );

  it.effect("rejects an external success URL before Polar IO", () =>
    Effect.gen(function* () {
      const { authed } = yield* setup();
      yield* Effect.promise(() =>
        expect(
          authed.action(route.generateCheckoutLink, {
            ...request,
            successUrl: "https://untrusted.example.com",
          })
        ).rejects.toThrow("INVALID_CHECKOUT_SUCCESS_URL")
      );
      expect(polarGateway.createCheckoutSession).not.toHaveBeenCalled();
    })
  );

  it.effect("withholds checkout when deletion starts during Polar IO", () =>
    Effect.gen(function* () {
      const { authed, t, user } = yield* setup();
      polarGateway.createCheckoutSession.mockReturnValue(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* Effect.promise(() =>
            t.mutation((ctx) =>
              ctx.db.patch("users", user.userId, {
                deletionPreparedAt: now,
              })
            )
          );
          return { url: "https://checkout.example.com/session" };
        })
      );
      yield* Effect.promise(() =>
        expect(
          authed.action(route.generateCheckoutLink, request)
        ).rejects.toThrow("UNAUTHORIZED")
      );
    })
  );

  it.effect(
    "refuses a Pro checkout while the user's personal Pro grant still runs, before Polar is asked",
    () =>
      Effect.gen(function* () {
        const { authed, t, user } = yield* setup();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.insert("billingGrants", {
              product: "pro",
              source: {
                kind: "contract",
                contractId: "contract-sessions-guard",
              },
              userId: user.userId,
              validFrom: Date.UTC(2000, 0, 1),
              validTo: Date.UTC(2099, 0, 1),
            })
          )
        );
        yield* Effect.promise(() =>
          expect(
            authed.action(route.generateCheckoutLink, request)
          ).rejects.toHaveProperty("data", {
            _tag: "ProAlreadyHeld",
            code: proAlreadyHeldCode,
            message:
              "This account already holds Pro. Manage the plan in the customer portal.",
          })
        );
        expect(polarGateway.createCheckoutSession).not.toHaveBeenCalled();
      })
  );

  it.effect.each([
    ["a pass while Indonesia stays on Polar", "polar", "pro.pass.1"],
    ["a pass while the switch names no rail", "midtrans", "pro.pass.1"],
    [
      "a rupiah subscription while the switch names no rail",
      "midtrans",
      "pro.monthly",
    ],
  ] as const)(
    "refuses %s before any provider is asked",
    ([_name, rail, offer]) =>
      Effect.gen(function* () {
        const { authed } = yield* setup();
        vi.stubEnv("BILLING_INDONESIA_RAIL", rail);
        yield* Effect.promise(() =>
          expect(
            authed.action(route.generateCheckoutLink, {
              ...request,
              currency: "IDR",
              offer,
            })
          ).rejects.toHaveProperty("data", {
            _tag: "CheckoutOfferUnavailable",
            code: checkoutOfferUnavailableCode,
            message: "This offer is not available here.",
          })
        );
        expect(polarGateway.createCheckoutSession).not.toHaveBeenCalled();
      }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllEnvs())))
  );

  it.effect(
    "sends a rupiah checkout to Polar while Indonesia stays on Polar",
    () =>
      Effect.gen(function* () {
        const { authed } = yield* setup();
        yield* Effect.promise(() =>
          authed.action(route.generateCheckoutLink, {
            ...request,
            currency: "IDR",
          })
        );
        expect(polarGateway.createCheckoutSession).toHaveBeenCalledOnce();
      })
  );

  it.effect("preserves the public checkout failure contract", () =>
    Effect.gen(function* () {
      const { authed } = yield* setup();
      polarGateway.createCheckoutSession.mockReturnValue(
        Effect.fail(
          new PolarCheckoutError({
            code: polarCheckoutErrorCode,
            message: "Checkout provider unavailable",
            cause: new Error("private provider response"),
          })
        )
      );
      yield* Effect.promise(() =>
        expect(
          authed.action(route.generateCheckoutLink, request)
        ).rejects.toHaveProperty("data", {
          _tag: "PolarCheckoutError",
          code: polarCheckoutErrorCode,
          message: "Checkout provider unavailable",
        })
      );
    })
  );
});
