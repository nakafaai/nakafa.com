import { describe, expect, it } from "@effect/vitest";
import {
  accountUnavailableCode,
  accountUnavailableMessage,
} from "@repo/backend/confect/auth/spec";
import { createAdmittedCheckoutSession } from "@repo/backend/confect/customers/checkout/session";
import {
  type CheckoutAdmission,
  CheckoutSessionIoError,
  CheckoutUnavailable,
  checkoutSessionIoErrorCode,
} from "@repo/backend/confect/customers/checkout/spec";
import { Effect } from "effect";

const checkout = {
  url: "https://polar.sh/checkout/test",
};
describe("customers/checkout/session", () => {
  it.effect("withholds a checkout created before deletion starts", () =>
    Effect.gen(function* () {
      const createCheckout = vi.fn(() => Effect.succeed(checkout));
      const admitCheckout = vi.fn(() =>
        Effect.succeed({
          kind: "unavailable",
        } satisfies CheckoutAdmission)
      );
      const failure = yield* createAdmittedCheckoutSession(
        Effect.suspend(createCheckout),
        Effect.suspend(admitCheckout)
      ).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(CheckoutUnavailable);
      expect(failure).toMatchObject({
        code: accountUnavailableCode,
        message: accountUnavailableMessage,
      });
      expect(createCheckout).toHaveBeenCalledOnce();
      expect(admitCheckout).toHaveBeenCalledOnce();
      expect(createCheckout.mock.invocationCallOrder[0]).toBeLessThan(
        admitCheckout.mock.invocationCallOrder[0] ?? 0
      );
    })
  );
  it.effect("returns a checkout admitted after Polar IO", () =>
    Effect.gen(function* () {
      const createCheckout = vi.fn(() => Effect.succeed(checkout));
      const admitCheckout = vi.fn(() =>
        Effect.succeed({
          kind: "admitted",
        } satisfies CheckoutAdmission)
      );
      expect(
        yield* createAdmittedCheckoutSession(
          Effect.suspend(createCheckout),
          Effect.suspend(admitCheckout)
        )
      ).toEqual(checkout);
    })
  );
  it.effect("preserves typed admission failures", () =>
    Effect.gen(function* () {
      const failure = new CheckoutSessionIoError({
        code: checkoutSessionIoErrorCode,
        message: "Convex unavailable",
      });
      const observed = yield* createAdmittedCheckoutSession(
        Effect.succeed(checkout),
        Effect.fail(failure)
      ).pipe(Effect.flip);
      expect(observed).toMatchObject({
        _tag: "CheckoutSessionIoError",
        code: checkoutSessionIoErrorCode,
        message: "Convex unavailable",
      });
    })
  );
});
