import { beforeEach, describe, expect, it } from "@effect/vitest";
import { accountUnavailableCode } from "@repo/backend/confect/auth/spec";
import { xenditCheckoutErrorCode } from "@repo/backend/confect/billing/spec";
import {
  proSessionRequest,
  renewalAnchor,
} from "@repo/backend/confect/billing/xendit/checkout";
import { XenditRequestFailed } from "@repo/backend/confect/billing/xendit/client";
import { ensureCustomer } from "@repo/backend/confect/billing/xendit/customers";
import { createSession } from "@repo/backend/confect/billing/xendit/sessions";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { DateTime, Effect } from "effect";
import { TestClock } from "effect/testing";

vi.mock(
  "@repo/backend/confect/billing/xendit/customers",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/confect/billing/xendit/customers")
    >()),
    ensureCustomer: vi.fn(),
  })
);
vi.mock(
  "@repo/backend/confect/billing/xendit/sessions",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/confect/billing/xendit/sessions")
    >()),
    createSession: vi.fn(),
  })
);

/** 26 Oct 2026, 12:00 in Jakarta. */
const NOW = Date.UTC(2026, 9, 26, 5, 0, 0);
/** An instant the runtime's real clock is far from, so a session that closes then stays open in every test. */
const FAR_FUTURE = Date.UTC(2099, 0, 1);

const route = api.billing.sessions;

/** A rupiah Pro checkout from the Indonesian page. */
const request = {
  currency: "IDR",
  locale: "id",
  offer: "pro.monthly",
  successUrl: "http://localhost:3000/id/settings/billing",
} as const;

/** The answer Xendit gives to Create Session, still open. */
function openedSession(overrides: Record<string, unknown> = {}) {
  return {
    expires_at: DateTime.makeUnsafe(FAR_FUTURE),
    payment_id: null,
    payment_link_url: "https://dev.xen.to/session-1",
    payment_session_id: "ps-1",
    payment_token_id: null,
    recurring_plan_id: "repl-1",
    reference_id: "reference-1",
    session_type: "SUBSCRIPTION" as const,
    status: "ACTIVE" as const,
    ...overrides,
  };
}

const setup = Effect.fn("billing.xendit.checkout.test.setup")(function* () {
  const t = createConvexTestWithBetterAuth();
  yield* TestClock.setTime(NOW);
  const user = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "xendit" })
    )
  );
  const authed = t.withIdentity({
    sessionId: user.sessionId,
    subject: user.authUserId,
  });
  return { authed, t, user };
});

/** The rows a checkout leaves: the learner's accounts, checkouts and subscriptions. */
function readRows(t: ReturnType<typeof createConvexTestWithBetterAuth>) {
  return Effect.promise(() =>
    t.run(async (ctx) => ({
      accounts: await ctx.db.query("billingAccounts").collect(),
      checkouts: await ctx.db.query("billingCheckouts").collect(),
      subscriptions: await ctx.db.query("billingSubscriptions").collect(),
    }))
  );
}

describe("billing/xendit/checkout requests", () => {
  it("renews a subscription on the same day in Jakarta, or on the 28th when the day is later", () => {
    expect(renewalAnchor(NOW, 1)).toBe("2026-11-26T12:00:00.000+07:00");
    // 30 Oct 20:00 UTC is already 31 Oct in Jakarta, and 30 Nov is past the 28th.
    expect(renewalAnchor(Date.UTC(2026, 9, 30, 20, 0, 0), 1)).toBe(
      "2026-11-28T03:00:00.000+07:00"
    );
    expect(renewalAnchor(Date.UTC(2027, 0, 10, 0, 0, 0), 12)).toBe(
      "2028-01-10T07:00:00.000+07:00"
    );
  });

  it("opens a pass as one payment and the monthly plan as a subscription charged at once", () => {
    const base = {
      amount: 79_000,
      customerId: "cust-1",
      now: NOW,
      referenceId: "reference-1",
      returnUrl: request.successUrl,
    };
    expect(
      proSessionRequest({ ...base, locale: "de", offer: "pro.pass.3" })
    ).toStrictEqual({
      amount: 79_000,
      cancel_return_url: request.successUrl,
      country: "ID",
      currency: "IDR",
      customer_id: "cust-1",
      description: "Nakafa Pro for 3 months",
      locale: "en",
      mode: "PAYMENT_LINK",
      reference_id: "reference-1",
      session_type: "PAY",
      success_return_url: request.successUrl,
    });
    expect(
      proSessionRequest({ ...base, locale: "id", offer: "pro.monthly" })
    ).toMatchObject({
      description: "Nakafa Pro, diperpanjang setiap bulan",
      locale: "id",
      session_type: "SUBSCRIPTION",
      subscription: {
        failed_cycle_action: "STOP",
        immediate_payment: true,
        schedule: {
          anchor_date: "2026-11-26T12:00:00.000+07:00",
          failed_attempt_notifications: [1, 2, 3],
          interval: "MONTH",
          interval_count: 1,
          retry_interval: "DAY",
          retry_interval_count: 1,
          total_retry: 3,
        },
      },
    });
  });
});

describe("billing/xendit/checkout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("BILLING_INDONESIA_RAIL", "xendit");
    vi.stubEnv("XENDIT_API_KEY", "test-secret");
    vi.mocked(ensureCustomer).mockReturnValue(Effect.succeed("cust-1"));
    vi.mocked(createSession).mockReturnValue(Effect.succeed(openedSession()));
    return () => {
      vi.unstubAllEnvs();
    };
  });

  it.effect(
    "opens a subscription for an Indonesian learner, and reopens it on a second request",
    () =>
      Effect.gen(function* () {
        const { authed, t, user } = yield* setup();
        const first = yield* Effect.promise(() =>
          authed.action(route.generateCheckoutLink, request)
        );
        const second = yield* Effect.promise(() =>
          authed.action(route.generateCheckoutLink, request)
        );
        expect(first).toEqual({ url: "https://dev.xen.to/session-1" });
        expect(second).toEqual(first);
        expect(createSession).toHaveBeenCalledOnce();
        expect(ensureCustomer).toHaveBeenCalledExactlyOnceWith({
          email: expect.any(String),
          individual_detail: { given_names: expect.any(String) },
          reference_id: user.authUserId,
          type: "INDIVIDUAL",
        });
        expect(vi.mocked(createSession).mock.calls[0]?.[0]).toMatchObject({
          amount: 79_000,
          customer_id: "cust-1",
          session_type: "SUBSCRIPTION",
          success_return_url: request.successUrl,
        });
        const rows = yield* readRows(t);
        expect(rows.accounts).toMatchObject([
          {
            country: "ID",
            currency: "IDR",
            providerCustomerId: "cust-1",
            rail: "xendit",
          },
        ]);
        expect(rows.checkouts).toMatchObject([
          {
            expiresAt: FAR_FUTURE,
            offer: "pro.monthly",
            sessionId: "ps-1",
            status: "open",
            url: "https://dev.xen.to/session-1",
          },
        ]);
        expect(rows.subscriptions).toMatchObject([
          {
            currentPeriodEnd: null,
            offer: "pro.monthly",
            provider: {
              channel: null,
              kind: "xendit",
              planId: "repl-1",
              tokenId: null,
            },
            providerUpdatedAt: 0,
            status: "pending",
          },
        ]);
      })
  );

  it.effect(
    "lets a pass holder buy another pass, and sends them to their plan for the monthly one",
    () =>
      Effect.gen(function* () {
        const { authed, t, user } = yield* setup();
        yield* Effect.promise(() =>
          t.run(async (ctx) => {
            const accountId = await ctx.db.insert("billingAccounts", {
              owner: { kind: "personal", userId: user.userId },
              rail: "xendit",
              country: "ID",
              currency: "IDR",
              providerCustomerId: "cust-1",
            });
            const paymentId = await ctx.db.insert("billingPayments", {
              kind: "pass",
              accountId,
              status: "succeeded",
              amount: 79_000,
              currency: "IDR",
              rail: "xendit",
              providerPaymentId: "py-pass",
              providerUpdatedAt: NOW,
              method: "session",
              paidAt: NOW,
            });
            await ctx.db.insert("billingGrants", {
              product: "pro",
              userId: user.userId,
              source: { kind: "pass", paymentId },
              validFrom: NOW,
              validTo: FAR_FUTURE,
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            authed.action(route.generateCheckoutLink, request)
          ).rejects.toHaveProperty("data", {
            _tag: "ProAlreadyHeld",
            code: "BILLING_PRO_ALREADY_HELD",
            message:
              "This account already holds Pro. Manage the plan in the customer portal.",
          })
        );
        vi.mocked(createSession).mockReturnValue(
          Effect.succeed(
            openedSession({
              payment_link_url: "https://dev.xen.to/pass-3",
              recurring_plan_id: null,
              session_type: "PAY",
            })
          )
        );
        const pass = yield* Effect.promise(() =>
          authed.action(route.generateCheckoutLink, {
            ...request,
            offer: "pro.pass.3",
          })
        );
        expect(pass).toEqual({ url: "https://dev.xen.to/pass-3" });
      })
  );

  it.effect(
    "opens a pass as a pay session with the learner's stored Xendit customer",
    () =>
      Effect.gen(function* () {
        const { authed, t } = yield* setup();
        yield* Effect.promise(() =>
          authed.action(route.generateCheckoutLink, request)
        );
        vi.mocked(createSession).mockReturnValue(
          Effect.succeed(
            openedSession({
              payment_link_url: "https://dev.xen.to/pass-12",
              payment_session_id: "ps-2",
              recurring_plan_id: null,
              session_type: "PAY",
            })
          )
        );
        const pass = yield* Effect.promise(() =>
          authed.action(route.generateCheckoutLink, {
            ...request,
            offer: "pro.pass.12",
          })
        );
        expect(pass).toEqual({ url: "https://dev.xen.to/pass-12" });
        expect(ensureCustomer).toHaveBeenCalledOnce();
        expect(vi.mocked(createSession).mock.calls[1]?.[0]).toMatchObject({
          amount: 790_000,
          customer_id: "cust-1",
          session_type: "PAY",
        });
        const rows = yield* readRows(t);
        expect(rows.checkouts).toHaveLength(2);
        expect(rows.subscriptions).toHaveLength(1);
      })
  );

  it.effect("withholds the session when deletion starts during Xendit IO", () =>
    Effect.gen(function* () {
      const { authed, t, user } = yield* setup();
      vi.mocked(createSession).mockReturnValue(
        Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch("users", user.userId, { deletionPreparedAt: NOW })
          )
        ).pipe(Effect.as(openedSession()))
      );
      yield* Effect.promise(() =>
        expect(
          authed.action(route.generateCheckoutLink, request)
        ).rejects.toThrow(accountUnavailableCode)
      );
      yield* Effect.promise(() =>
        expect(
          authed.action(route.generateCheckoutLink, request)
        ).rejects.toThrow()
      );
      const rows = yield* readRows(t);
      expect(rows.checkouts).toStrictEqual([]);
      expect(rows.subscriptions).toStrictEqual([]);
      expect(createSession).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "refuses a learner whose account is deleting before Xendit is asked",
    () =>
      Effect.gen(function* () {
        const { authed, t, user } = yield* setup();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch("users", user.userId, { deletionPreparedAt: NOW })
          )
        );
        yield* Effect.promise(() =>
          expect(
            authed.action(route.generateCheckoutLink, request)
          ).rejects.toThrow()
        );
        expect(ensureCustomer).not.toHaveBeenCalled();
        expect(createSession).not.toHaveBeenCalled();
      })
  );

  it.effect.each([
    {
      answer: Effect.fail(
        new XenditRequestFailed({
          errorCode: "INVALID_PAYMENT_CHANNEL",
          message: "No channel is active.",
          status: 400,
        })
      ),
      name: "a Xendit failure",
    },
    {
      answer: Effect.succeed(openedSession({ payment_link_url: null })),
      name: "a session without a payment link",
    },
  ])("reports $name as the public checkout failure", ({ answer }) =>
    Effect.gen(function* () {
      const { authed, t } = yield* setup();
      vi.mocked(createSession).mockReturnValue(answer);
      yield* Effect.promise(() =>
        expect(
          authed.action(route.generateCheckoutLink, request)
        ).rejects.toHaveProperty("data", {
          _tag: "XenditCheckoutError",
          code: xenditCheckoutErrorCode,
          message: "Failed to create checkout session.",
        })
      );
      const rows = yield* readRows(t);
      expect(rows.checkouts).toStrictEqual([]);
    })
  );
});
