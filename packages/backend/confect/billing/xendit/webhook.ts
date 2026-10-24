import { Array as Arr, Schema } from "effect";

/** The envelope every Xendit webhook shares. `data` is decoded per event. */
export const XenditWebhookEnvelope = Schema.Struct({
  event: Schema.String,
  business_id: Schema.String,
  created: Schema.String,
  data: Schema.Struct({
    id: Schema.optionalKey(Schema.String),
    status: Schema.optionalKey(Schema.String),
    updated: Schema.optionalKey(Schema.String),
  }),
});

/**
 * The key that makes one delivery unique: the event, the object, its status and
 * its update time. A retry of the same change repeats the key; a new change
 * does not.
 */
export function xenditDeliveryKey(
  envelope: typeof XenditWebhookEnvelope.Type
): string {
  const { data } = envelope;
  return Arr.join(
    [envelope.event, data.id ?? "", data.status ?? "", data.updated ?? ""],
    ":"
  );
}

/**
 * Compares the received callback token with the deployment's token in time that
 * depends only on the lengths. Xendit sends the token in `x-callback-token`.
 */
export function sameCallbackToken(received: string, expected: string): boolean {
  if (received.length !== expected.length) {
    return false;
  }
  const mismatches = Arr.reduce(
    Arr.fromIterable(received),
    0,
    (count, character, index) => count + (character === expected[index] ? 0 : 1)
  );
  return mismatches === 0;
}
