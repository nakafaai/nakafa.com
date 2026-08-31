import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { ProductAnalyticsCaptureError } from "@repo/backend/convex/analytics/capture";
import type { ProductAnalyticsEvent } from "@repo/backend/convex/analytics/events";
import { admitCheckoutProgram } from "@repo/backend/convex/customers/checkout/impl";
import { CheckoutSessionIoError } from "@repo/backend/convex/customers/checkout/spec";
import schema from "@repo/backend/convex/schema";
import { seedAnalyticsConsent } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { vi } from "vitest";

const NOW = Date.UTC(2026, 7, 31, 5, 0, 0);
const checkoutStartedEvent = {
  name: "checkout started",
  properties: {
    checkout_locale: "en",
    customer_ip_available: true,
    locale: "en",
    product_count: 1,
    product_id: "product-pro",
  },
} as const satisfies ProductAnalyticsEvent;
describe("customers/checkout/admission", () => {
  it.effect("admits an active account without analytics consent", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("users", {
            authId: "checkout-without-consent-auth",
            credits: 10,
            creditsResetAt: NOW,
            email: "checkout-without-consent@example.com",
            name: "Checkout Without Consent",
            plan: "free",
          })
        )
      );

      const admitted = yield* Effect.promise(() =>
        t.mutation(internal.customers.checkout.admission.admitCheckoutSession, {
          event: checkoutStartedEvent,
          timestamp: NOW,
          userId,
        })
      );
      const scheduledJobs = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.system.query("_scheduled_functions").collect())
      );

      expect(admitted).toBe(true);
      expect(scheduledJobs).toEqual([]);
    })
  );

  it.effect("captures analytics when an active account has consent", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const insertedUserId = await ctx.db.insert("users", {
            authId: "checkout-with-consent-auth",
            credits: 10,
            creditsResetAt: NOW,
            email: "checkout-with-consent@example.com",
            name: "Checkout With Consent",
            plan: "free",
          });
          await seedAnalyticsConsent(ctx, {
            decidedAt: NOW,
            userId: insertedUserId,
          });
          return insertedUserId;
        })
      );

      const admitted = yield* Effect.promise(() =>
        t.mutation(internal.customers.checkout.admission.admitCheckoutSession, {
          event: checkoutStartedEvent,
          timestamp: NOW,
          userId,
        })
      );
      const scheduledJobs = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.system.query("_scheduled_functions").collect())
      );

      expect(admitted).toBe(true);
      expect(scheduledJobs).toEqual([
        expect.objectContaining({
          args: [
            expect.objectContaining({
              event: checkoutStartedEvent.name,
              properties: JSON.stringify(checkoutStartedEvent.properties),
              timestamp: NOW,
            }),
          ],
          name: expect.stringContaining("deliverProductEvent"),
        }),
      ]);
    })
  );

  it.effect("withholds checkout while account deletion is prepared", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("users", {
            authId: "deleting-checkout-auth",
            credits: 10,
            creditsResetAt: NOW,
            deletionPreparedAt: NOW,
            email: "deleting-checkout@example.com",
            name: "Deleting Checkout",
            plan: "free",
          })
        )
      );

      const admitted = yield* Effect.promise(() =>
        t.mutation(internal.customers.checkout.admission.admitCheckoutSession, {
          event: checkoutStartedEvent,
          userId,
        })
      );

      expect(admitted).toBe(false);
    })
  );

  it.effect("does not block checkout when optional analytics fails", () =>
    Effect.gen(function* () {
      const admitted = yield* admitCheckoutProgram({
        captureEvent: () =>
          Effect.fail(
            new ProductAnalyticsCaptureError({
              code: "PRODUCT_ANALYTICS_CAPTURE_FAILED",
              message: "PostHog unavailable",
            })
          ),
        loadUser: () => Promise.resolve({}),
      });

      expect(admitted).toBe(true);
    })
  );

  it.effect("preserves account revalidation failures", () =>
    Effect.gen(function* () {
      const captureEvent = vi.fn(() => Effect.succeed(true));
      const failure = yield* admitCheckoutProgram({
        captureEvent,
        loadUser: () => Promise.reject(new Error("Convex unavailable")),
      }).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(CheckoutSessionIoError);
      expect(captureEvent).not.toHaveBeenCalled();
    })
  );
});
