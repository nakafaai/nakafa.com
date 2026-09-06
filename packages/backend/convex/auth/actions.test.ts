import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { Effect, Schema } from "effect";

describe("auth/actions", () => {
  it.effect("creates and returns a persisted signing key for static JWKS", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const first = yield* Effect.promise(() =>
        t.action(internal.auth.actions.getLatestJwks)
      );
      const keys = yield* Schema.decodeEffect(
        Schema.Array(
          Schema.Struct({
            alg: Schema.Literal("RS256"),
            privateKey: Schema.NonEmptyString,
            publicKey: Schema.NonEmptyString,
          })
        )
      )(first);
      expect(keys).toHaveLength(1);
      expect(
        yield* Effect.promise(() =>
          t.action(internal.auth.actions.getLatestJwks)
        )
      ).toEqual(first);
    })
  );
});
