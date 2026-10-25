import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  billingNavigationProgram,
  checkoutReturnUrl,
} from "@/lib/billing/navigation";

describe("billing navigation", () => {
  it("returns the buyer to the page they left, with its query and anchor", () => {
    expect(
      checkoutReturnUrl("https://nakafa.com/en/pricing?plan=pro#compare")
    ).toBe("https://nakafa.com/en/pricing?plan=pro#compare");
  });

  it("sends no share token to the payment processor", () => {
    // 43 URL-safe characters, the shape of a share token.
    const token = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE";

    expect(
      checkoutReturnUrl(`https://nakafa.com/en/chat/chat-1#share=${token}`)
    ).toBe("https://nakafa.com/en/chat/chat-1");
    expect(
      checkoutReturnUrl(`https://nakafa.com/en/chat/chat-1#a=1&share=${token}`)
    ).toBe("https://nakafa.com/en/chat/chat-1#a=1");
  });

  it.effect("opens the destination returned by the billing action", () =>
    Effect.gen(function* () {
      const navigate = vi.fn();
      const onFailure = vi.fn(() => Effect.void);

      yield* billingNavigationProgram({
        navigate,
        onFailure,
        request: Effect.succeed({ url: "https://checkout.polar.sh/test" }),
      });

      expect(navigate).toHaveBeenCalledWith("https://checkout.polar.sh/test");
      expect(onFailure).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "reports a rejected action without escaping to the error boundary",
    () =>
      Effect.gen(function* () {
        const failure = new Error("Checkout unavailable");
        const navigate = vi.fn();
        const onFailure = vi.fn(() => Effect.void);

        yield* billingNavigationProgram({
          navigate,
          onFailure,
          request: Effect.fail(failure),
        });

        expect(onFailure).toHaveBeenCalledWith(failure);
        expect(navigate).not.toHaveBeenCalled();
      })
  );
});
