import { describe, expect, it } from "@effect/vitest";
import {
  TryoutRuntimeError,
  toTryoutRuntimeError,
  tryRuntimePromise,
} from "@repo/backend/convex/tryouts/runtime/error";
import { ConvexError } from "convex/values";
import { Effect } from "effect";

describe("tryouts/runtime/error", () => {
  it("preserves typed runtime and Convex failures", () => {
    const runtimeError = new TryoutRuntimeError({
      code: "TRYOUT_RUNTIME_TEST",
      message: "Typed runtime failure.",
    });

    expect(toTryoutRuntimeError(runtimeError)).toBe(runtimeError);
    expect(
      toTryoutRuntimeError(
        new ConvexError({
          code: "TRYOUT_CONVEX_TEST",
          message: "Typed Convex failure.",
        })
      )
    ).toMatchObject({
      code: "TRYOUT_CONVEX_TEST",
      message: "Typed Convex failure.",
    });
  });

  it("normalizes malformed and unknown failures", () => {
    expect(
      toTryoutRuntimeError(
        new ConvexError({ message: "Missing structured error code." })
      )
    ).toMatchObject({ code: "TRYOUT_RUNTIME_FAILED" });
    expect(
      toTryoutRuntimeError(new ConvexError({ code: "TRYOUT_MISSING_MESSAGE" }))
    ).toMatchObject({ code: "TRYOUT_RUNTIME_FAILED" });
    expect(
      toTryoutRuntimeError(
        new ConvexError({ code: "TRYOUT_MALFORMED", message: 1 })
      )
    ).toMatchObject({ code: "TRYOUT_RUNTIME_FAILED" });
    expect(toTryoutRuntimeError(new ConvexError("opaque"))).toMatchObject({
      code: "TRYOUT_RUNTIME_FAILED",
    });
    expect(
      toTryoutRuntimeError(new Error("Unknown runtime failure."))
    ).toMatchObject({
      code: "TRYOUT_RUNTIME_FAILED",
      message: "Unable to complete try-out runtime operation.",
    });
    expect(
      toTryoutRuntimeError(new Error("Unknown runtime failure.")).message
    ).not.toContain("Unknown runtime failure.");
  });

  it.live("lifts promise operations", () =>
    Effect.gen(function* () {
      expect(yield* tryRuntimePromise(() => Promise.resolve("ready"))).toBe(
        "ready"
      );
      expect(
        yield* Effect.flip(
          tryRuntimePromise(() => Promise.reject(new Error("Promise failed.")))
        )
      ).toMatchObject({
        code: "TRYOUT_RUNTIME_FAILED",
        message: "Unable to complete try-out runtime operation.",
      });
    })
  );
});
