import { sha256Hex } from "@repo/utilities/digest";
import { Array as Arr, Effect, Schema } from "effect";

/** The callback token of the request is not the deployment's token, so the request is not Xendit's. */
export class XenditTokenRejected extends Schema.TaggedError<XenditTokenRejected>()(
  "XenditTokenRejected",
  {}
) {}

/** The envelope every Xendit webhook shares. The processor decodes `data` per event. */
export const XenditWebhookEnvelope = Schema.Struct({
  event: Schema.String,
  business_id: Schema.String,
  created: Schema.DateTimeUtcFromString,
  data: Schema.Struct({
    id: Schema.optionalKey(Schema.String),
    payment_session_id: Schema.optionalKey(Schema.String),
    status: Schema.optionalKey(Schema.String),
    updated: Schema.optionalKey(Schema.String),
  }),
});
export type XenditWebhookEnvelope = typeof XenditWebhookEnvelope.Type;

/**
 * The key that makes one delivery unique: the event, the object, its status and
 * its update time. A retry of the same change repeats the key; a new change does
 * not. A payment session carries no update time and reaches each status once, so
 * its event, session and status are its key: Xendit stamps `created` anew on each
 * retry, and a body digest would store every retry. Any other delivery that names
 * no object or no update time is keyed by the SHA-256 of its body instead, so two
 * different deliveries of one event never share a key.
 */
export const xenditDeliveryKey = Effect.fn("billing.xendit.deliveryKey")(
  function* (envelope: XenditWebhookEnvelope, body: string) {
    const { data } = envelope;
    if (data.payment_session_id !== undefined && data.status !== undefined) {
      return Arr.join(
        [envelope.event, data.payment_session_id, data.status],
        ":"
      );
    }
    if (data.id === undefined || data.updated === undefined) {
      const digest = yield* sha256Hex(body);
      return `${envelope.event}:body:${digest}`;
    }
    return Arr.join(
      [envelope.event, data.id, data.status ?? "", data.updated],
      ":"
    );
  }
);

/**
 * Compares the received callback token with the deployment's token in time that
 * depends only on the lengths. Xendit sends the token in `x-callback-token`. The
 * comparison runs over UTF-16 code units, the units `length` counts, so a token
 * with a character outside the Basic Multilingual Plane still matches itself.
 */
export function sameCallbackToken(received: string, expected: string): boolean {
  if (received.length !== expected.length) {
    return false;
  }
  const mismatches = Arr.reduce(
    Arr.makeBy(received.length, (index) => index),
    0,
    (count, index) =>
      count +
      (received.charCodeAt(index) === expected.charCodeAt(index) ? 0 : 1)
  );
  return mismatches === 0;
}
