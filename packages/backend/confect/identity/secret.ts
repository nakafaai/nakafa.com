import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import {
  CODE_LENGTH,
  codeFromBytes,
} from "@repo/backend/confect/identity/code";
import { Config, Crypto, Effect, Redacted } from "effect";
import { Hex } from "effect/encoding";

/** Names what the hash is for, so the same secret never hashes a code for another purpose. */
const CODE_HASH_LABEL = "nakafa/identity/card/v1:";
const encoder = new TextEncoder();

/**
 * Draws a new canonical code from Effect's `Crypto` service, which reads the
 * platform's secure random source. Effect's default `Random` is not secure, so
 * a code never comes from it.
 */
export const drawCardCode = Effect.fn("identity.code.draw")(
  function* () {
    const bytes = yield* (yield* Crypto.Crypto).randomBytes(CODE_LENGTH);
    return codeFromBytes(bytes);
  },
  Effect.orDie,
  Effect.provide(WebCryptoLayer)
);

/**
 * The keyed hash of a canonical code: HMAC-SHA-256 under the server secret, in
 * hex. Only this hash is stored, so without the secret nobody can check a
 * guessed code against the table. A missing secret is a deployment defect.
 * This module reads the secret, so only Convex functions may import it.
 */
export const hashCardCode = Effect.fn("identity.code.hash")(function* (
  code: string
) {
  const secret = yield* Config.Redacted("LOGIN_CARD_SECRET");
  const key = yield* Effect.promise(() =>
    crypto.subtle.importKey(
      "raw",
      encoder.encode(Redacted.value(secret)),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["sign"]
    )
  );
  const signature = yield* Effect.promise(() =>
    crypto.subtle.sign("HMAC", key, encoder.encode(`${CODE_HASH_LABEL}${code}`))
  );
  return Hex.encode(new Uint8Array(signature));
}, Effect.orDie);
