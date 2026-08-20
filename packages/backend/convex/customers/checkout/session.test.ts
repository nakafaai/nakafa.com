import { createAdmittedCheckoutSession } from "@repo/backend/convex/customers/checkout/session";
import {
  CheckoutSessionIoError,
  checkoutSessionIoErrorCode,
} from "@repo/backend/convex/customers/checkout/spec";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Result } from "effect";
import { vi } from "vitest";

const checkout = { url: "https://polar.sh/checkout/test" };
describe("customers/checkout/session", () => {
  it.live("withholds a checkout created before deletion starts", () =>
    Effect.gen(function* () {
      const createCheckout = vi.fn(() => Effect.succeed(checkout));
      const admitCheckout = vi.fn(() => Effect.succeed(false));
      expect(
        yield* createAdmittedCheckoutSession({ admitCheckout, createCheckout })
      ).toBeNull();
      expect(createCheckout).toHaveBeenCalledOnce();
      expect(admitCheckout).toHaveBeenCalledOnce();
      expect(createCheckout.mock.invocationCallOrder[0]).toBeLessThan(
        admitCheckout.mock.invocationCallOrder[0] ?? 0
      );
    })
  );
  it.live("returns a checkout admitted after Polar IO", () =>
    Effect.gen(function* () {
      const createCheckout = vi.fn(() => Effect.succeed(checkout));
      const admitCheckout = vi.fn(() => Effect.succeed(true));
      expect(
        yield* createAdmittedCheckoutSession({ admitCheckout, createCheckout })
      ).toEqual(checkout);
    })
  );
  it.live("preserves typed admission failures", () =>
    Effect.gen(function* () {
      const failure = new CheckoutSessionIoError({
        code: checkoutSessionIoErrorCode,
        message: "Convex unavailable",
      });
      const result = yield* Effect.result(
        createAdmittedCheckoutSession({
          admitCheckout: () => Effect.fail(failure),
          createCheckout: () => Effect.succeed(checkout),
        })
      );
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toMatchObject({
          _tag: "CheckoutSessionIoError",
          code: checkoutSessionIoErrorCode,
          message: "Convex unavailable",
        });
      }
    })
  );
});
