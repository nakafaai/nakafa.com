import { createAdmittedCheckoutSession } from "@repo/backend/convex/customers/checkout/session";
import {
  CheckoutSessionIoError,
  checkoutSessionIoErrorCode,
} from "@repo/backend/convex/customers/checkout/spec";
import { Effect, Either } from "effect";
import { describe, expect, it, vi } from "vitest";

const checkout = { url: "https://polar.sh/checkout/test" };

describe("customers/checkout/session", () => {
  it("withholds a checkout created before deletion starts", async () => {
    const createCheckout = vi.fn(() => Effect.succeed(checkout));
    const admitCheckout = vi.fn(() => Effect.succeed(false));

    await expect(
      Effect.runPromise(
        createAdmittedCheckoutSession({ admitCheckout, createCheckout })
      )
    ).resolves.toBeNull();
    expect(createCheckout).toHaveBeenCalledOnce();
    expect(admitCheckout).toHaveBeenCalledOnce();
    expect(createCheckout.mock.invocationCallOrder[0]).toBeLessThan(
      admitCheckout.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("returns a checkout admitted after Polar IO", async () => {
    const createCheckout = vi.fn(() => Effect.succeed(checkout));
    const admitCheckout = vi.fn(() => Effect.succeed(true));

    await expect(
      Effect.runPromise(
        createAdmittedCheckoutSession({ admitCheckout, createCheckout })
      )
    ).resolves.toEqual(checkout);
  });

  it("preserves typed admission failures", async () => {
    const failure = new CheckoutSessionIoError({
      code: checkoutSessionIoErrorCode,
      message: "Convex unavailable",
    });

    const result = await Effect.runPromise(
      Effect.either(
        createAdmittedCheckoutSession({
          admitCheckout: () => Effect.fail(failure),
          createCheckout: () => Effect.succeed(checkout),
        })
      )
    );

    expect(Either.isLeft(result)).toBe(true);

    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "CheckoutSessionIoError",
        code: checkoutSessionIoErrorCode,
        message: "Convex unavailable",
      });
    }
  });
});
