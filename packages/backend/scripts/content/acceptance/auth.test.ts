import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  createLocalJwks,
  LOCAL_AUTH_SECRET,
} from "@repo/backend/scripts/content/acceptance/auth";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { Array as Arr, Effect, Order, Record as Rec, Schema } from "effect";

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
/** A stored key as a plain record, so a member that the structs above would drop shows. */
const StoredJwk = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown)
);
const ALGORITHM: RsaHashedImportParams = {
  hash: "SHA-256",
  name: "RSASSA-PKCS1-v1_5",
};
const message = new TextEncoder().encode("local session token");

afterEach(() => {
  vi.restoreAllMocks();
});

/** Creates one local JWKS and reads its only key. */
const createKey = Effect.fn("AuthTest.createKey")(function* () {
  const [key, ...others] = yield* createLocalJwks().pipe(
    Effect.flatMap(Schema.decodeEffect(Jwks))
  );
  expect(others).toEqual([]);
  if (!key) {
    return yield* Effect.die("Expected one local signing key.");
  }
  return key;
});

/** Decrypts the private half the way Better Auth's JWT plugin does before it signs. */
const readPrivateText = Effect.fn("AuthTest.readPrivateText")(function* (
  privateKey: string
) {
  const encrypted = yield* Schema.decodeEffect(
    Schema.fromJsonString(Schema.String)
  )(privateKey);
  return yield* Effect.promise(() =>
    symmetricDecrypt({ data: encrypted, key: LOCAL_AUTH_SECRET })
  );
});

describe("local session signing key", () => {
  it.effect(
    "signs with the key Better Auth decrypts and verifies with its public half",
    () =>
      Effect.gen(function* () {
        const key = yield* createKey();
        const privateJwk = yield* readPrivateText(key.privateKey).pipe(
          Effect.flatMap(Schema.decodeEffect(PrivateJwk))
        );
        const publicJwk = yield* Schema.decodeEffect(PublicJwk)(key.publicKey);
        const signature = yield* Effect.promise(() =>
          crypto.subtle
            .importKey("jwk", privateJwk, ALGORITHM, false, ["sign"])
            .then((signing) =>
              crypto.subtle.sign(ALGORITHM.name, signing, message)
            )
        );

        expect(
          yield* Effect.promise(() =>
            crypto.subtle
              .importKey("jwk", publicJwk, ALGORITHM, false, ["verify"])
              .then((verifying) =>
                crypto.subtle.verify(
                  ALGORITHM.name,
                  verifying,
                  signature,
                  message
                )
              )
          )
        ).toBe(true);
        const next = yield* createKey();
        expect(next.id).not.toBe(key.id);
        expect(next.publicKey).not.toBe(key.publicKey);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect(
    "stores the members that Better Auth's own key writes and no more",
    () =>
      Effect.gen(function* () {
        const key = yield* createKey();
        const stored = yield* Effect.all({
          privateKey: readPrivateText(key.privateKey).pipe(
            Effect.flatMap(Schema.decodeEffect(StoredJwk))
          ),
          publicKey: Schema.decodeEffect(StoredJwk)(key.publicKey),
        });

        expect(Arr.sort(Rec.keys(stored.publicKey), Order.String)).toEqual([
          "e",
          "kty",
          "n",
        ]);
        expect(Arr.sort(Rec.keys(stored.privateKey), Order.String)).toEqual([
          "d",
          "dp",
          "dq",
          "e",
          "kty",
          "n",
          "p",
          "q",
          "qi",
        ]);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.effect("fails typed when the key pair cannot be generated", () =>
    Effect.gen(function* () {
      vi.spyOn(crypto.subtle, "generateKey").mockRejectedValueOnce(
        new Error("Web Crypto is unavailable")
      );

      expect(yield* createLocalJwks().pipe(Effect.flip)).toMatchObject({
        _tag: "AcceptanceRuntimeError",
        message: "The local session signing key could not be generated.",
      });
    }).pipe(Effect.provide(nodeServicesLayer))
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
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});
