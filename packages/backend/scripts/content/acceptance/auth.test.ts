import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { describe, expect, it } from "@effect/vitest";
import {
  createLocalJwks,
  LOCAL_AUTH_SECRET,
} from "@repo/backend/scripts/content/acceptance/auth";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { Effect, Schema } from "effect";

vi.mock("better-auth/crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("better-auth/crypto")>();
  return { ...original, symmetricEncrypt: vi.fn(original.symmetricEncrypt) };
});

const Jwks = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      alg: Schema.Literal("RS256"),
      createdAt: Schema.Finite,
      id: Schema.String,
      privateKey: Schema.String,
      publicKey: Schema.String,
    })
  )
);
const PublicJwk = Schema.fromJsonString(
  Schema.Struct({
    e: Schema.String,
    kty: Schema.Literal("RSA"),
    n: Schema.String,
  })
);
const PrivateJwk = Schema.fromJsonString(
  Schema.Struct({
    d: Schema.String,
    dp: Schema.String,
    dq: Schema.String,
    e: Schema.String,
    kty: Schema.Literal("RSA"),
    n: Schema.String,
    p: Schema.String,
    q: Schema.String,
    qi: Schema.String,
  })
);
const message = Buffer.from("local session token");

describe("local session signing key", () => {
  it.effect(
    "signs with the key Better Auth decrypts and verifies with its public half",
    () =>
      Effect.gen(function* () {
        const [key, ...others] = yield* createLocalJwks().pipe(
          Effect.flatMap(Schema.decodeEffect(Jwks))
        );
        expect(others).toEqual([]);
        if (!key) {
          return yield* Effect.die("Expected one local signing key.");
        }
        // The same steps Better Auth's JWT plugin takes before it signs.
        const encrypted = yield* Schema.decodeEffect(
          Schema.fromJsonString(Schema.String)
        )(key.privateKey);
        const privateJwk = yield* Effect.promise(() =>
          symmetricDecrypt({ data: encrypted, key: LOCAL_AUTH_SECRET })
        ).pipe(Effect.flatMap(Schema.decodeEffect(PrivateJwk)));
        const publicJwk = yield* Schema.decodeEffect(PublicJwk)(key.publicKey);
        const signature = sign(
          "sha256",
          message,
          createPrivateKey({ format: "jwk", key: privateJwk })
        );

        expect(
          verify(
            "sha256",
            message,
            createPublicKey({ format: "jwk", key: publicJwk }),
            signature
          )
        ).toBe(true);
        const [next] = yield* createLocalJwks().pipe(
          Effect.flatMap(Schema.decodeEffect(Jwks))
        );
        expect(next?.id).not.toBe(key.id);
        expect(next?.publicKey).not.toBe(key.publicKey);
      })
  );

  it.effect("fails typed when the private key cannot be encrypted", () =>
    Effect.gen(function* () {
      vi.mocked(symmetricEncrypt).mockRejectedValueOnce(
        new Error("Web Crypto is unavailable")
      );

      expect(yield* createLocalJwks().pipe(Effect.flip)).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "The local session signing key could not be encrypted.",
      });
    })
  );
});
