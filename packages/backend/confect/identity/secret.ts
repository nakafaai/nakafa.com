import {
  CODE_LENGTH,
  codeFromBytes,
} from "@repo/backend/confect/identity/code";
import { Config, Effect, Redacted } from "effect";
import { SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";

/** Names what each hash is for, so the same secret never hashes a code for another purpose. */
const CODE_HASH_LABEL = "nakafa/identity/card/v1:";
const GUARDIAN_CODE_LABEL = "nakafa/identity/guardian-code/v1:";
const encoder = new TextEncoder();

/**
 * Draws a new canonical code from Effect's `SecureRandom` service, which reads the
 * platform's secure random source. Effect's default `Random` is not secure, so
 * a code never comes from it.
 */
export const drawCardCode = Effect.fn("identity.code.draw")(
  function* () {
    const bytes = yield* (yield* SecureRandom.SecureRandom).randomBytes(CODE_LENGTH);
    return codeFromBytes(bytes);
  },
  Effect.provide(SecureRandom.layerWebCrypto)
);

/**
 * HMAC-SHA-256 of a labelled text under the server secret, in hex. Only such a
 * hash is stored, so without the secret nobody can check a guessed code against
 * the table. A missing secret is a deployment defect. This module reads the
 * secret, so only Convex functions may import it.
 */
const keyedHash = Effect.fnUntraced(function* (text: string) {
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
    crypto.subtle.sign("HMAC", key, encoder.encode(text))
  );
  return Hex.encode(new Uint8Array(signature));
}, Effect.orDie);

/** The keyed hash of a canonical card code. */
export const hashCardCode = Effect.fn("identity.code.hash")(function* (
  code: string
) {
  return yield* keyedHash(`${CODE_HASH_LABEL}${code}`);
});

/** How many six-digit codes there are. */
const GUARDIAN_CODE_RANGE = 1_000_000n;

/**
 * Draws a six-digit guardian code from Effect's `SecureRandom` service. Eight random
 * bytes taken modulo a million leave every code within 5.5 x 10^-14 of equally
 * likely, so no draw is repeated.
 */
export const drawGuardianCode = Effect.fn("identity.guardianCode.draw")(
  function* () {
    const bytes = yield* (yield* SecureRandom.SecureRandom).randomBytes(8);
    const value = new DataView(bytes.buffer, bytes.byteOffset).getBigUint64(0);
    return String(value % GUARDIAN_CODE_RANGE).padStart(6, "0");
  },
  Effect.provide(SecureRandom.layerWebCrypto)
);

/**
 * The keyed hash of a guardian code, under its own purpose label (ADR 0034), and
 * bound to the school and the address it was sent to, so a code matches only the
 * sign-in it was drawn for and never a login card's hash.
 */
export const hashGuardianCode = Effect.fn("identity.guardianCode.hash")(
  function* (tenantId: string, email: string, code: string) {
    return yield* keyedHash(
      `${GUARDIAN_CODE_LABEL}${tenantId}:${email}:${code}`
    );
  }
);
