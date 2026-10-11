import { afterEach, describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { symmetricDecrypt } from "better-auth/crypto";
import { Effect, Schema } from "effect";

const SECRET = "synthetic-better-auth-secret-for-signing-key-tests";
const SigningKeys = Schema.Array(
  Schema.Struct({
    alg: Schema.Literal("RS256"),
    privateKey: Schema.NonEmptyString,
    publicKey: Schema.NonEmptyString,
  })
);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth/actions", () => {
  it.effect("creates and returns a persisted signing key for static JWKS", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const first = yield* Effect.promise(() =>
        t.action(internal.auth.actions.getLatestJwks)
      );
      const keys = yield* Schema.decodeEffect(SigningKeys)(first);
      expect(keys).toHaveLength(1);
      expect(
        yield* Effect.promise(() =>
          t.action(internal.auth.actions.getLatestJwks)
        )
      ).toEqual(first);
    })
  );

  it.effect(
    "returns the private half of the signing key encrypted with the auth secret",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
        const t = createConvexTestWithBetterAuth();
        const [key] = yield* Schema.decodeEffect(SigningKeys)(
          yield* Effect.promise(() =>
            t.action(internal.auth.actions.getLatestJwks)
          )
        );
        const PrivateJwk = Schema.fromJsonString(
          Schema.Struct({ d: Schema.String, kty: Schema.Literal("RSA") })
        );
        // The stored text is a JSON string that holds the cipher text, not a key.
        expect(
          yield* Schema.decodeEffect(PrivateJwk)(key.privateKey).pipe(
            Effect.flip
          )
        ).toBeInstanceOf(Schema.SchemaError);
        const sealed = yield* Schema.decodeEffect(
          Schema.fromJsonString(Schema.String)
        )(key.privateKey);
        const opened = yield* Effect.promise(() =>
          symmetricDecrypt({ data: sealed, key: SECRET })
        );
        expect(yield* Schema.decodeEffect(PrivateJwk)(opened)).toMatchObject({
          kty: "RSA",
        });
      })
  );
});
