import { describe, expect, it } from "@effect/vitest";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { ConvexError } from "convex/values";
import { Cause, Effect, Exit, Result } from "effect";

/** Runs one internal invocation at the Vitest boundary. */
function call<A>(invoke: () => Promise<A>) {
  return callInternal(invoke).pipe(Effect.result);
}
describe("content publication internal invocation", () => {
  it.live("returns successful internal values unchanged", () =>
    Effect.gen(function* () {
      expect(yield* call(() => Promise.resolve("ready"))).toEqual(
        Result.succeed("ready")
      );
    })
  );
  it.live("recovers direct and serialized stable publication failures", () =>
    Effect.gen(function* () {
      const expected = new ReleaseError({
        code: "CONTENT_RELEASE_CONFLICT",
        message: "Technical conflict.",
      });
      const direct = yield* call(() => Promise.reject(expected));
      const serialized = yield* call(() =>
        Promise.reject(
          new ConvexError({
            code: expected.code,
            message: expected.message,
          })
        )
      );
      expect(direct).toEqual(Result.fail(expected));
      expect(serialized).toEqual(Result.fail(expected));
    })
  );
  it.live("keeps unknown infrastructure failures in the defect channel", () =>
    Effect.gen(function* () {
      const failure = new Error("technical infrastructure failure");
      const exit = yield* Effect.exit(
        callInternal(() => Promise.reject(failure))
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.findDefect(exit.cause)).toEqual(Result.succeed(failure));
      }
    })
  );
});
