import { Effect } from "effect";
import { Hex } from "effect/encoding";

const encoder = new TextEncoder();

/** The header that carries the signature of one attempt. */
export const SIGNATURE_HEADER = "nakafa-signature";

/**
 * The signature of one attempt: HMAC-SHA-256 over the timestamp, a dot and the body, under
 * the webhook's secret, in hex (ADR 0029). The timestamp is signed with the body, so a
 * receiver that refuses an old timestamp also refuses a replay.
 */
export const signBody = Effect.fn("integrations.signature.sign")(function* (
  secret: string,
  timestamp: number,
  body: string
) {
  const key = yield* Effect.promise(() =>
    crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["sign"]
    )
  );
  const signature = yield* Effect.promise(() =>
    crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`))
  );
  return `t=${timestamp},v1=${Hex.encode(new Uint8Array(signature))}`;
});
