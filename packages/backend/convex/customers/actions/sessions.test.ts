import { beforeEach, describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  PolarCheckoutError,
  polarCheckoutErrorCode,
} from "@repo/backend/convex/customers/polar/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { Effect } from "effect";

const polarGateway = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  getCustomerByExternalId: vi.fn(),
  getCustomerById: vi.fn(),
}));
vi.mock("@repo/backend/convex/customers/polar/live", () => ({ polarGateway }));

const routes = [api.customers.actions.public, api.customers.actions.sessions];
const request = {
  locale: "de",
  successUrl: "http://localhost:3000/de/settings/billing",
} as const;

const setup = Effect.fn("customers.sessions.test.setup")(function* () {
  const t = createConvexTestWithBetterAuth();
  const user = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: Date.now(), suffix: "billing" })
    )
  );
  const customer = {
    email: "billing@example.com",
    externalId: user.authUserId,
    id: "polar-billing",
    metadata: { userId: user.userId },
    name: "User billing",
  };
  polarGateway.getCustomerByExternalId.mockReturnValue(
    Effect.succeed(customer)
  );
  polarGateway.getCustomerById.mockReturnValue(Effect.succeed(customer));
  const authed = t.withIdentity({
    sessionId: user.sessionId,
    subject: user.authUserId,
  });
  return { authed, t, user };
});

describe.each(routes)("billing route rollout", (route) => {
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
          productIds: [expect.any(String)],
          successUrl: request.successUrl,
        });
      })
  );

  it.effect("creates the authenticated user's customer portal", () =>
    Effect.gen(function* () {
      const { authed } = yield* setup();
      const portal = yield* Effect.promise(() =>
        authed.action(route.generateCustomerPortalUrl, {})
      );
      expect(portal).toEqual({ url: "https://portal.example.com/session" });
      expect(polarGateway.createCustomerPortalSession).toHaveBeenCalledWith(
        "polar-billing"
      );
    })
  );

  it.effect("rejects unauthenticated requests before Polar IO", () =>
    Effect.gen(function* () {
      const { t } = yield* setup();
      yield* Effect.promise(() =>
        expect(t.action(route.generateCheckoutLink, request)).rejects.toThrow()
      );
      yield* Effect.promise(() =>
        expect(t.action(route.generateCustomerPortalUrl, {})).rejects.toThrow()
      );
      expect(polarGateway.getCustomerByExternalId).not.toHaveBeenCalled();
      expect(polarGateway.createCheckoutSession).not.toHaveBeenCalled();
      expect(polarGateway.createCustomerPortalSession).not.toHaveBeenCalled();
    })
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
          yield* Effect.promise(() =>
            t.mutation((ctx) =>
              ctx.db.patch("users", user.userId, {
                deletionPreparedAt: Date.now(),
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

  it.effect("preserves the public checkout failure contract", () =>
    Effect.gen(function* () {
      const { authed } = yield* setup();
      polarGateway.createCheckoutSession.mockReturnValue(
        Effect.fail(
          new PolarCheckoutError({
            code: polarCheckoutErrorCode,
            message: "Checkout provider unavailable",
          })
        )
      );
      yield* Effect.promise(() =>
        expect(
          authed.action(route.generateCheckoutLink, request)
        ).rejects.toThrow(polarCheckoutErrorCode)
      );
    })
  );
});
