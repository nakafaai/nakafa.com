import { describe, expect, it } from "@effect/vitest";
import {
  sameCallbackToken,
  XenditWebhookEnvelope,
  xenditDeliveryKey,
} from "@repo/backend/confect/billing/xendit/webhook";
import { Effect, Schema } from "effect";

/** Decodes one webhook body as the route does, so the key is computed from the decoded envelope. */
const envelopeOf = (body: string) =>
  Schema.decodeEffect(Schema.fromJsonString(XenditWebhookEnvelope))(body);

describe("billing/xendit/webhook", () => {
  it("accepts the deployment's callback token and refuses any other", () => {
    expect(sameCallbackToken("token-abc", "token-abc")).toBe(true);
    expect(sameCallbackToken("token-abd", "token-abc")).toBe(false);
    expect(sameCallbackToken("token", "token-abc")).toBe(false);
    expect(sameCallbackToken("", "token-abc")).toBe(false);
  });

  it("compares UTF-16 code units, so a token with a non-BMP character matches itself", () => {
    expect(sameCallbackToken("tok😀", "tok😀")).toBe(true);
    expect(sameCallbackToken("tok😀", "tok😁")).toBe(false);
  });

  it.effect(
    "keys a delivery by its event, object, status and update time",
    () =>
      Effect.gen(function* () {
        const body =
          '{"business_id":"biz_1","created":"2026-10-24T00:00:00Z","data":{"id":"recy_1","status":"SUCCEEDED","updated":"2026-10-24T00:00:01Z"},"event":"recurring.cycle.succeeded"}';
        const key = yield* xenditDeliveryKey(yield* envelopeOf(body), body);
        expect(key).toBe(
          "recurring.cycle.succeeded:recy_1:SUCCEEDED:2026-10-24T00:00:01Z"
        );
      })
  );

  it.effect(
    "keys a delivery without an update time by the digest of its body, so distinct deliveries stay distinct",
    () =>
      Effect.gen(function* () {
        const first =
          '{"business_id":"biz_1","created":"2026-10-24T00:00:00Z","data":{},"event":"payment_token.expiry"}';
        const second =
          '{"business_id":"biz_1","created":"2026-10-24T00:00:00Z","data":{"id":"ptok_2"},"event":"payment_token.expiry"}';
        const firstKey = yield* xenditDeliveryKey(
          yield* envelopeOf(first),
          first
        );
        const retry = yield* xenditDeliveryKey(yield* envelopeOf(first), first);
        const secondKey = yield* xenditDeliveryKey(
          yield* envelopeOf(second),
          second
        );
        expect(firstKey.startsWith("payment_token.expiry:body:")).toBe(true);
        expect(retry).toBe(firstKey);
        expect(secondKey).not.toBe(firstKey);
      })
  );

  it.effect(
    "keys a payment session by its event, session and status, so a retry with a new created time repeats the key",
    () =>
      Effect.gen(function* () {
        const delivery = (created: string) =>
          `{"business_id":"biz_1","created":"${created}","data":{"payment_session_id":"ps_1","reference_id":"checkout-1","session_type":"PAY","status":"COMPLETED"},"event":"payment_session.completed"}`;
        const first = delivery("2026-10-25T20:00:00Z");
        const retry = delivery("2026-10-25T20:15:00Z");
        const key = yield* xenditDeliveryKey(yield* envelopeOf(first), first);
        expect(key).toBe("payment_session.completed:ps_1:COMPLETED");
        expect(yield* xenditDeliveryKey(yield* envelopeOf(retry), retry)).toBe(
          key
        );
      })
  );

  it.effect("keys a delivery without a status by an empty status", () =>
    Effect.gen(function* () {
      const body =
        '{"business_id":"biz_1","created":"2026-10-24T00:00:00Z","data":{"id":"recy_9","updated":"2026-10-24T00:00:02Z"},"event":"recurring.cycle.retrying"}';
      const key = yield* xenditDeliveryKey(yield* envelopeOf(body), body);
      expect(key).toBe("recurring.cycle.retrying:recy_9::2026-10-24T00:00:02Z");
    })
  );
});
