import {
  getUnknownErrorMessage,
  readConvexErrorData,
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { describe, expect, it } from "@repo/testing/effect";
import { ConvexError } from "convex/values";
import { Cause, Clock, Effect, Schema } from "effect";
import { vi } from "vitest";

const boundaryFailureCode = "BOUNDARY_FAILURE";

class BoundaryFailure extends Schema.TaggedError<BoundaryFailure>()(
  "BoundaryFailure",
  {
    code: Schema.Literal(boundaryFailureCode),
    message: Schema.String,
  }
) {}

describe("lib/effect", () => {
  it("runs successful programs at the Convex boundary", async () => {
    await expect(runConvexProgram(Effect.succeed("ok"))).resolves.toBe("ok");
  });

  it("does not use the Performance API while running traced programs", async () => {
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => {
      throw new Error("Performance API is unavailable");
    });
    const tracedProgram = Effect.fn("test.tracedProgram")(function* () {
      return yield* Effect.succeed("ok");
    });

    await expect(runConvexProgram(tracedProgram())).resolves.toBe("ok");

    nowSpy.mockRestore();
  });

  it("uses a Date-backed clock inside native Convex handlers", async () => {
    const now = 1_780_000_000_000;
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    await expect(runConvexProgram(Clock.currentTimeMillis)).resolves.toBe(now);
    await expect(runConvexProgram(Clock.currentTimeNanos)).resolves.toBe(
      BigInt(now) * 1_000_000n
    );
    await expect(
      runConvexProgram(
        Clock.clockWith((clock) =>
          Effect.sync(() => [
            clock.currentTimeMillisUnsafe(),
            clock.currentTimeNanosUnsafe(),
          ])
        )
      )
    ).resolves.toEqual([now, BigInt(now) * 1_000_000n]);

    dateNowSpy.mockRestore();
  });

  it("rejects sleeping inside native Convex handlers", async () => {
    await expect(runConvexProgram(Effect.sleep(1))).rejects.toThrow(
      "Effect.sleep is not supported inside native Convex handlers."
    );
  });

  it("does not schedule timers when native programs yield", async () => {
    const setImmediateSpy = vi
      .spyOn(globalThis, "setImmediate")
      .mockImplementation(() => {
        throw new Error("setImmediate is unavailable in native Convex");
      });
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(() => {
        throw new Error("setTimeout is unavailable in native Convex");
      });

    try {
      await expect(
        runConvexProgram(Effect.yieldNow.pipe(Effect.as("done")))
      ).resolves.toBe("done");
      expect(setImmediateSpy).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    } finally {
      setImmediateSpy.mockRestore();
      setTimeoutSpy.mockRestore();
    }
  });

  it("supports the live clock at the Node action boundary", async () => {
    await expect(
      runConvexActionProgram(Effect.sleep(1).pipe(Effect.as("done")))
    ).resolves.toBe("done");
  });

  it("maps tagged Effect failures into ConvexError payloads", async () => {
    let thrown: unknown;

    try {
      await runConvexProgram(
        Effect.fail(
          new BoundaryFailure({
            code: boundaryFailureCode,
            message: "Boundary failed",
          })
        )
      );
    } catch (error) {
      thrown = error;
    }

    if (typeof thrown !== "object" || thrown === null || !("data" in thrown)) {
      throw new Error(
        "Expected runConvexProgram to throw a ConvexError shape."
      );
    }

    expect(thrown.data).toEqual({
      code: boundaryFailureCode,
      message: "Boundary failed",
    });
  });

  it("preserves unexpected defects instead of turning them into domain errors", async () => {
    await expect(runConvexProgram(Effect.die("defect"))).rejects.toThrow(
      "defect"
    );
  });

  it("preserves a defect when a cause also contains a tagged failure", async () => {
    const defect = new Error("Unexpected boundary defect");
    const cause = Cause.fromReasons([
      Cause.makeFailReason(
        new BoundaryFailure({
          code: boundaryFailureCode,
          message: "Boundary failed",
        })
      ),
      Cause.makeDieReason(defect),
    ]);

    await expect(runConvexProgram(Effect.failCause(cause))).rejects.toBe(
      defect
    );
  });

  it("normalizes unknown thrown values into messages", () => {
    expect(getUnknownErrorMessage(new Error("Exploded"))).toBe("Exploded");
    expect(getUnknownErrorMessage("plain failure")).toBe("plain failure");
  });

  it("reads only complete typed Convex error payloads", () => {
    expect(
      readConvexErrorData(
        new ConvexError({ code: "BOUNDARY_FAILURE", message: "Failed" })
      )
    ).toEqual({ code: "BOUNDARY_FAILURE", message: "Failed" });
    expect(
      readConvexErrorData(new ConvexError({ code: "MISSING" }))
    ).toBeNull();
    expect(readConvexErrorData(new ConvexError("opaque"))).toBeNull();
    expect(readConvexErrorData(new Error("not Convex"))).toBeNull();
  });
});
