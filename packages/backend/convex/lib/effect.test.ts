import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { Clock, Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

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
        Effect.clockWith((clock) =>
          Effect.sync(() => [
            clock.unsafeCurrentTimeMillis(),
            clock.unsafeCurrentTimeNanos(),
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

  it("normalizes unknown thrown values into messages", () => {
    expect(getUnknownErrorMessage(new Error("Exploded"))).toBe("Exploded");
    expect(getUnknownErrorMessage("plain failure")).toBe("plain failure");
  });
});
