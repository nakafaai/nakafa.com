import {
  TryoutRuntimeError,
  toTryoutRuntimeError,
  tryRuntimePromise,
  tryRuntimeSync,
} from "@repo/backend/convex/tryouts/runtime/error";
import { ConvexError } from "convex/values";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

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
      message: "Unknown runtime failure.",
    });
  });

  it("lifts promise and synchronous operations", async () => {
    await expect(
      Effect.runPromise(tryRuntimePromise(() => Promise.resolve("ready")))
    ).resolves.toBe("ready");
    await expect(
      Effect.runPromise(
        Effect.flip(
          tryRuntimePromise(() => Promise.reject(new Error("Promise failed.")))
        )
      )
    ).resolves.toMatchObject({
      code: "TRYOUT_RUNTIME_FAILED",
      message: "Promise failed.",
    });
    await expect(
      Effect.runPromise(tryRuntimeSync(() => "ready"))
    ).resolves.toBe("ready");
    await expect(
      Effect.runPromise(
        Effect.flip(
          tryRuntimeSync(() => {
            throw new Error("Sync failed.");
          })
        )
      )
    ).resolves.toMatchObject({
      code: "TRYOUT_RUNTIME_FAILED",
      message: "Sync failed.",
    });
  });
});
