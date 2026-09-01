import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { billingNavigationProgram } from "@/lib/billing/navigation";

describe("billing navigation", () => {
  it.effect("opens the destination returned by the billing action", () =>
    Effect.gen(function* () {
      const navigate = vi.fn();
      const onFailure = vi.fn(() => Effect.void);

      yield* billingNavigationProgram({
        navigate,
        onFailure,
        request: () =>
          Promise.resolve({ url: "https://checkout.polar.sh/test" }),
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
          request: () => Promise.reject(failure),
        });

        expect(onFailure).toHaveBeenCalledWith(failure);
        expect(navigate).not.toHaveBeenCalled();
      })
  );
});
