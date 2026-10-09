import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { billingNavigationProgram } from "@/lib/billing/navigation";
import { ConvexOfflineError } from "@/lib/convex/online";

describe("billing navigation", () => {
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

  it.effect("hands a refused offline start to the failure handler", () =>
    Effect.gen(function* () {
      const refusal = new ConvexOfflineError({
        message: "Convex is offline, so the request was not started.",
      });
      const navigate = vi.fn();
      const onFailure = vi.fn(() => Effect.void);

      yield* billingNavigationProgram({
        navigate,
        onFailure,
        request: Effect.fail(refusal),
      });

      expect(onFailure).toHaveBeenCalledWith(refusal);
      expect(navigate).not.toHaveBeenCalled();
    })
  );
});
