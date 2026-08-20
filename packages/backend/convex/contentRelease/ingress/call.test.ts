import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { ConvexError } from "convex/values";
import { Cause, Effect, Exit, Result } from "effect";
import { describe, expect, it } from "vitest";

/** Runs one internal invocation at the Vitest boundary. */
function call<A>(invoke: () => Promise<A>) {
  return Effect.runPromise(callInternal(invoke).pipe(Effect.result));
}
describe("content publication internal invocation", () => {
  it("returns successful internal values unchanged", async () => {
    await expect(call(() => Promise.resolve("ready"))).resolves.toEqual(
      Result.succeed("ready")
    );
  });
  it("recovers direct and serialized stable publication failures", async () => {
    const expected = new ReleaseError({
      code: "CONTENT_RELEASE_CONFLICT",
      message: "Technical conflict.",
    });
    const direct = await call(() => Promise.reject(expected));
    const serialized = await call(() =>
      Promise.reject(
        new ConvexError({
          code: expected.code,
          message: expected.message,
        })
      )
    );
    expect(direct).toEqual(Result.fail(expected));
    expect(serialized).toEqual(Result.fail(expected));
  });
  it("keeps unknown infrastructure failures in the defect channel", async () => {
    const failure = new Error("technical infrastructure failure");
    const exit = await Effect.runPromiseExit(
      callInternal(() => Promise.reject(failure))
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.findDefect(exit.cause)).toEqual(Result.succeed(failure));
    }
  });
});
