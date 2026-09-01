import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  getUnknownErrorMessage,
  readConvexErrorData,
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { ConvexError } from "convex/values";
import { Cause, Clock, Effect, Schema } from "effect";

const boundaryFailureCode = "BOUNDARY_FAILURE";

class BoundaryFailure extends Schema.TaggedError<BoundaryFailure>()(
  "BoundaryFailure",
  {
    code: Schema.Literal(boundaryFailureCode),
    message: Schema.String,
  }
) {}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lib/effect", () => {
  it.effect("runs successful programs at the Convex boundary", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(() =>
        runConvexProgram(Effect.succeed("ok"))
      );

      expect(result).toBe("ok");
    })
  );

  it.effect(
    "does not use the Performance API while running traced programs",
    () =>
      Effect.gen(function* () {
        yield* Effect.sync(() => {
          vi.spyOn(performance, "now").mockImplementation(() => {
            throw new Error("Performance API is unavailable");
          });
        });
        const tracedProgram = Effect.fn("test.tracedProgram")(function* () {
          return yield* Effect.succeed("ok");
        });
        const result = yield* Effect.promise(() =>
          runConvexProgram(tracedProgram())
        );

        expect(result).toBe("ok");
      })
  );

  it.effect("uses a Date-backed clock inside native Convex handlers", () =>
    Effect.gen(function* () {
      const now = 1_780_000_000_000;
      yield* Effect.sync(() => {
        vi.spyOn(Date, "now").mockReturnValue(now);
      });
      const milliseconds = yield* Effect.promise(() =>
        runConvexProgram(Clock.currentTimeMillis)
      );
      const nanoseconds = yield* Effect.promise(() =>
        runConvexProgram(Clock.currentTimeNanos)
      );
      const unsafeTimes = yield* Effect.promise(() =>
        runConvexProgram(
          Clock.clockWith((clock) =>
            Effect.sync(() => [
              clock.currentTimeMillisUnsafe(),
              clock.currentTimeNanosUnsafe(),
            ])
          )
        )
      );

      expect(milliseconds).toBe(now);
      expect(nanoseconds).toBe(BigInt(now) * 1_000_000n);
      expect(unsafeTimes).toEqual([now, BigInt(now) * 1_000_000n]);
    })
  );

  it.effect("rejects sleeping inside native Convex handlers", () =>
    Effect.promise(() =>
      expect(runConvexProgram(Effect.sleep(1))).rejects.toThrow(
        "Effect.sleep is not supported inside native Convex handlers."
      )
    )
  );

  it.effect("does not schedule timers when native programs yield", () =>
    Effect.gen(function* () {
      const setImmediateSpy = yield* Effect.sync(() =>
        vi.spyOn(globalThis, "setImmediate").mockImplementation(() => {
          throw new Error("setImmediate is unavailable in native Convex");
        })
      );
      const setTimeoutSpy = yield* Effect.sync(() =>
        vi.spyOn(globalThis, "setTimeout").mockImplementation(() => {
          throw new Error("setTimeout is unavailable in native Convex");
        })
      );
      const result = yield* Effect.promise(() =>
        runConvexProgram(Effect.yieldNow.pipe(Effect.as("done")))
      );

      expect(result).toBe("done");
      expect(setImmediateSpy).not.toHaveBeenCalled();
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    })
  );

  it.effect("supports the live clock at the Node action boundary", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(() =>
        runConvexActionProgram(Effect.sleep(1).pipe(Effect.as("done")))
      );

      expect(result).toBe("done");
    })
  );

  it.effect("maps tagged Effect failures into ConvexError payloads", () =>
    Effect.promise(() =>
      expect(
        runConvexProgram(
          Effect.fail(
            new BoundaryFailure({
              code: boundaryFailureCode,
              message: "Boundary failed",
            })
          )
        )
      ).rejects.toMatchObject({
        data: {
          code: boundaryFailureCode,
          message: "Boundary failed",
        },
      })
    )
  );

  it.effect(
    "preserves unexpected defects instead of turning them into domain errors",
    () =>
      Effect.promise(() =>
        expect(runConvexProgram(Effect.die("defect"))).rejects.toThrow("defect")
      )
  );

  it.effect(
    "preserves a defect when a cause also contains a tagged failure",
    () =>
      Effect.gen(function* () {
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

        yield* Effect.promise(() =>
          expect(runConvexProgram(Effect.failCause(cause))).rejects.toBe(defect)
        );
      })
  );

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
