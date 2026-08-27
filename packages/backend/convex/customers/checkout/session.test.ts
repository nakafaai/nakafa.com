import { describe, expect, it } from "@effect/vitest";
import { createAdmittedCheckoutSession } from "@repo/backend/convex/customers/checkout/session";
import {
  CheckoutSessionIoError,
  checkoutSessionIoErrorCode,
} from "@repo/backend/convex/customers/checkout/spec";
import { Effect } from "effect";
import { vi } from "vitest";

const checkout = { url: "https://polar.sh/checkout/test" };
describe("customers/checkout/session", () => {
  it.effect("withholds a checkout created before deletion starts", () =>
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
  it.effect("returns a checkout admitted after Polar IO", () =>
    Effect.gen(function* () {
      const createCheckout = vi.fn(() => Effect.succeed(checkout));
      const admitCheckout = vi.fn(() => Effect.succeed(true));
      expect(
        yield* createAdmittedCheckoutSession({ admitCheckout, createCheckout })
      ).toEqual(checkout);
    })
  );
  it.effect("preserves typed admission failures", () =>
    Effect.gen(function* () {
      const failure = new CheckoutSessionIoError({
        code: checkoutSessionIoErrorCode,
        message: "Convex unavailable",
      });
      const observed = yield* createAdmittedCheckoutSession({
        admitCheckout: () => Effect.fail(failure),
        createCheckout: () => Effect.succeed(checkout),
      }).pipe(Effect.flip);
      expect(observed).toMatchObject({
        _tag: "CheckoutSessionIoError",
        code: checkoutSessionIoErrorCode,
        message: "Convex unavailable",
      });
    })
  );
});
