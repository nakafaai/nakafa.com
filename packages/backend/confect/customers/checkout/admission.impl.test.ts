import { describe, expect, it } from "@effect/vitest";
import type { ProductAnalyticsEvent } from "@repo/backend/confect/analytics/events";
import { admitCheckoutProgram } from "@repo/backend/confect/customers/checkout/impl";
import {
  CheckoutSessionIoError,
  checkoutSessionIoError,
} from "@repo/backend/confect/customers/checkout/spec";
import { seedAnalyticsConsent } from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 7, 31, 5, 0, 0);
const JsonSchema = Schema.fromJsonString(Schema.Unknown);
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

      expect(admitted).toEqual({ kind: "admitted" });
      expect(scheduledJobs).toEqual([]);
    })
  );

  it.effect.each([NOW, undefined])(
    "captures consented analytics with timestamp %s",
    (timestamp) =>
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
          t.mutation(
            internal.customers.checkout.admission.admitCheckoutSession,
            {
              event: checkoutStartedEvent,
              ...(timestamp === undefined ? {} : { timestamp }),
              userId,
            }
          )
        );
        const scheduledJobs = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db.system.query("_scheduled_functions").collect()
          )
        );
        const encodedProperties = yield* Schema.encodeEffect(JsonSchema)(
          checkoutStartedEvent.properties
        );

        expect(admitted).toEqual({ kind: "admitted" });
        expect(scheduledJobs).toEqual([
          expect.objectContaining({
            args: [
              expect.objectContaining({
                event: checkoutStartedEvent.name,
                properties: encodedProperties,
                ...(timestamp === undefined ? {} : { timestamp }),
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

      expect(admitted).toEqual({ kind: "unavailable" });
    })
  );

  it("rejects a physically missing account without recording checkout analytics", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const id = await ctx.db.insert("users", {
        authId: "missing-checkout",
        credits: 0,
        creditsResetAt: NOW,
        email: "missing@example.com",
        name: "Missing",
        plan: "free",
      });
      await ctx.db.delete("users", id);
      return id;
    });
    await expect(
      t.mutation(internal.customers.checkout.admission.admitCheckoutSession, {
        event: checkoutStartedEvent,
        userId,
      })
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(
      t.query((ctx) => ctx.db.system.query("_scheduled_functions").collect())
    ).resolves.toEqual([]);
  });

  it.effect("preserves account revalidation failures", () =>
    Effect.gen(function* () {
      const captureEvent = vi.fn(() => Effect.void);
      const failure = yield* admitCheckoutProgram({
        captureEvent,
        loadUser: () =>
          Effect.fail(checkoutSessionIoError(new Error("Convex unavailable"))),
      }).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(CheckoutSessionIoError);
      expect(captureEvent).not.toHaveBeenCalled();
    })
  );
});
