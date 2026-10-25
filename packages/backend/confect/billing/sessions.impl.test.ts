import { beforeEach, describe, expect, it } from "@effect/vitest";
import { polarProductIdFor } from "@repo/backend/confect/billing/polar/catalog";
import {
  PolarCheckoutError,
  PolarDuplicateEmailError,
  polarCheckoutErrorCode,
  polarDuplicateEmailCode,
} from "@repo/backend/confect/billing/polar/spec";
import { proAlreadyHeldCode } from "@repo/backend/confect/billing/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Clock, Effect, Option } from "effect";
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

const setup = Effect.fn("billing.sessions.test.setup")(function* (
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

describe("billing/sessions", () => {
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

describe("billing/sessions customer linking", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    polarGateway.createCustomerPortalSession.mockReturnValue(
      Effect.succeed({ url: "https://portal.example.com/session" })
    );
  });

  it.effect(
    "creates the Polar customer for a user Polar does not hold, and reuses it afterwards",
    () =>
      Effect.gen(function* () {
        const { authed } = yield* setup();
        polarGateway.getCustomerByExternalId.mockReturnValue(
          Effect.succeed(null)
        );
        polarGateway.createCustomer.mockReturnValue(
          Effect.succeed({
            email: "billing@example.com",
            externalId: "user",
            id: "polar-created",
            name: "User billing",
          })
        );
        yield* Effect.promise(() =>
          authed.action(route.generateCustomerPortalUrl, {})
        );
        yield* Effect.promise(() =>
          authed.action(route.generateCustomerPortalUrl, {})
        );
        expect(polarGateway.createCustomer).toHaveBeenCalledOnce();
        expect(
          polarGateway.createCustomerPortalSession
        ).toHaveBeenLastCalledWith("polar-created");
      })
  );

  it.effect(
    "syncs a drifted customer and leaves an identical one unchanged",
    () =>
      Effect.gen(function* () {
        const { authed, t, user } = yield* setup();
        const stored = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.get("users", user.userId))
        );
        const identity = {
          email: stored?.email ?? "",
          externalId: user.authUserId,
          name: stored?.name ?? "",
        };
        polarGateway.getCustomerByExternalId.mockReturnValueOnce(
          Effect.succeed({ ...identity, id: "polar-same" })
        );
        yield* Effect.promise(() =>
          authed.action(route.generateCustomerPortalUrl, {})
        );
        expect(polarGateway.updateCustomer).not.toHaveBeenCalled();
        expect(
          polarGateway.createCustomerPortalSession
        ).toHaveBeenLastCalledWith("polar-same");
        const drifted = yield* setup();
        polarGateway.getCustomerByExternalId.mockReturnValueOnce(
          Effect.succeed({ ...identity, id: "polar-drift", name: "Old name" })
        );
        polarGateway.updateCustomer.mockReturnValueOnce(
          Effect.succeed({ ...identity, id: "polar-drift" })
        );
        yield* Effect.promise(() =>
          drifted.authed.action(route.generateCustomerPortalUrl, {})
        );
        expect(polarGateway.updateCustomer).toHaveBeenCalledWith({
          customerId: "polar-drift",
          identity,
        });
      })
  );

  it.effect(
    "adopts the Polar customer that holds the address when the user may: one without an external ID takes the user's, any other keeps its own",
    () =>
      Effect.gen(function* () {
        const held = (externalId: string | null) => ({
          email: "billing@example.com",
          externalId,
          id: `polar-${externalId ?? "unlinked"}`,
          name: "User billing",
        });
        const portalOf = Effect.fn("billing.sessions.test.portalOf")(function* (
          emailVerified: boolean,
          externalId: (authId: string) => string | null
        ) {
          const { authed, user } = yield* setup(emailVerified);
          polarGateway.getCustomerByExternalId.mockReturnValue(
            Effect.succeed(null)
          );
          polarGateway.createCustomer.mockReturnValue(
            Effect.fail(
              new PolarDuplicateEmailError({
                code: polarDuplicateEmailCode,
                message:
                  "A Polar customer already exists for this email address.",
              })
            )
          );
          polarGateway.findCustomerByEmail.mockReturnValue(
            Effect.succeed(held(externalId(user.authUserId)))
          );
          polarGateway.updateCustomer.mockReturnValue(
            Effect.succeed(held("adopted"))
          );
          yield* Effect.promise(() =>
            authed.action(route.generateCustomerPortalUrl, {})
          );
          return user.authUserId;
        });
        yield* portalOf(true, () => null);
        expect(
          polarGateway.createCustomerPortalSession
        ).toHaveBeenLastCalledWith("polar-adopted");
        expect(polarGateway.updateCustomer).toHaveBeenCalledWith({
          customerId: "polar-unlinked",
          identity: expect.objectContaining({ email: "billing@example.com" }),
        });
        polarGateway.updateCustomer.mockClear();
        yield* portalOf(true, () => "auth-removed");
        expect(
          polarGateway.createCustomerPortalSession
        ).toHaveBeenLastCalledWith("polar-auth-removed");
        const ownAuthId = yield* portalOf(false, (authId) => authId);
        expect(
          polarGateway.createCustomerPortalSession
        ).toHaveBeenLastCalledWith(`polar-${ownAuthId}`);
        expect(polarGateway.updateCustomer).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "keeps the duplicate refusal when Polar finds no customer, the address is unverified, or another user holds the customer",
    () =>
      Effect.gen(function* () {
        const refusal = Effect.fn("billing.sessions.test.refusal")(function* (
          emailVerified: boolean,
          heldExternalId: Option.Option<string | null>
        ) {
          const { authed, t } = yield* setup(emailVerified);
          yield* Effect.promise(() =>
            t.mutation((ctx) =>
              ctx.db.insert("users", {
                authId: "auth-other",
                credits: 0,
                creditsResetAt: NOW,
                email: "other@example.com",
                mascot: MASCOT_CODE,
                name: "Other",
                plan: "free",
              })
            )
          );
          polarGateway.getCustomerByExternalId.mockReturnValue(
            Effect.succeed(null)
          );
          polarGateway.createCustomer.mockReturnValue(
            Effect.fail(
              new PolarDuplicateEmailError({
                code: polarDuplicateEmailCode,
                message:
                  "A Polar customer already exists for this email address.",
              })
            )
          );
          polarGateway.findCustomerByEmail.mockReturnValue(
            Effect.succeed(
              Option.match(heldExternalId, {
                onNone: () => null,
                onSome: (externalId) => ({
                  email: "billing@example.com",
                  externalId,
                  id: "polar-held",
                  name: "User billing",
                }),
              })
            )
          );
          yield* Effect.promise(() =>
            expect(
              authed.action(route.generateCustomerPortalUrl, {})
            ).rejects.toHaveProperty(
              ["data", "_tag"],
              "PolarDuplicateEmailError"
            )
          );
        });
        yield* refusal(true, Option.none());
        yield* refusal(false, Option.some(null));
        yield* refusal(true, Option.some("auth-other"));
        expect(polarGateway.updateCustomer).not.toHaveBeenCalled();
        expect(polarGateway.createCustomerPortalSession).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "refuses a success URL that is not an absolute URL, and a server selection it does not know",
    () =>
      Effect.gen(function* () {
        const { authed } = yield* setup();
        yield* Effect.promise(() =>
          expect(
            authed.action(route.generateCheckoutLink, {
              ...request,
              successUrl: "not a url",
            })
          ).rejects.toThrow("INVALID_CHECKOUT_SUCCESS_URL")
        );
        vi.stubEnv("POLAR_SERVER", "staging");
        yield* Effect.promise(() =>
          expect(
            authed.action(route.generateCheckoutLink, request)
          ).rejects.toThrow("POLAR_CHECKOUT_ERROR")
        );
        vi.unstubAllEnvs();
        expect(polarGateway.createCheckoutSession).not.toHaveBeenCalled();
      })
  );
});
