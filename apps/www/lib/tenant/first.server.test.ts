// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { orUndefined } from "@/lib/tenant/first.server";

/** A read that the test backend fails with, so a first screen answers no value for it. */
class ReadFailed extends Schema.TaggedError<ReadFailed>()("ReadFailed", {
  cause: Schema.Unknown,
}) {}

describe("first-screen read", () => {
  it.effect("keeps the value of a read the server answered", () =>
    Effect.gen(function* () {
      expect(yield* orUndefined(Effect.succeed("exam"))).toBe("exam");
    })
  );

  it.effect(
    "yields no value for a failed read, so the live query decides",
    () =>
      Effect.gen(function* () {
        expect(
          yield* orUndefined(Effect.fail(new ReadFailed({ cause: "network" })))
        ).toBeUndefined();
      })
  );
});
