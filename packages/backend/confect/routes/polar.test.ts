// @vitest-environment edge-runtime

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { encodeJsonText } from "@repo/utilities/json";
import { DateTime, Effect, Option, Schema } from "effect";

const WEBHOOK_SECRET = "polar_webhook_route_test";
const DELIVERY_ID = "msg_route_test";

vi.mock("@polar-sh/sdk/2026-10", async (importOriginal) => {
  const sdk = await importOriginal<typeof import("@polar-sh/sdk/2026-10")>();
  return {
    ...sdk,
    webhooks: {
      ...sdk.webhooks,
      validateEvent: vi.fn(sdk.webhooks.validateEvent),
    },
  };
});

/** Signs a body the way Polar does, so the SDK verifies the signature for real. */
async function signWebhook(body: string, id = DELIVERY_ID) {
  const timestamp = String(
    Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / 1000)
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`)
  );
  return {
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-signature": `v1,${btoa(String.fromCharCode(...new Uint8Array(digest)))}`,
    "webhook-timestamp": timestamp,
  };
}

/** Posts one request to the Polar route of the test deployment. */
const postWebhook = Effect.fn("routes.polar.test.post")(function* (
  target: TestDeployment,
  body: string,
  headers: Record<string, string>
) {
  return yield* target.fetch("/polar/events", {
    body,
    headers,
    method: "POST",
  });
});

/** Posts a body signed with the webhook secret, which the route verifies. */
const postSigned = Effect.fn("routes.polar.test.postSigned")(function* (
  target: TestDeployment,
  body: string,
  id = DELIVERY_ID
) {
  const headers = yield* Effect.promise(() => signWebhook(body, id));
  return yield* postWebhook(target, body, headers);
});

/** One subscription webhook body, as Polar sends it. */
const subscriptionBody = encodeJsonText({
  data: { id: "sub_route" },
  timestamp: "2026-10-25T00:00:00.000Z",
  type: "subscription.created",
});

type TestDeployment = Effect.Success<typeof Confect>;

const StoredDelivery = Schema.NullOr(
  Schema.Struct({
    key: Schema.String,
    payload: Schema.String,
    processedAt: Schema.NullOr(Schema.Finite),
    rail: Schema.String,
    type: Schema.String,
  })
);

/** The stored inbox row of one Polar delivery, or none when the route stored nothing. */
const storedDelivery = Effect.fn("routes.polar.test.storedDelivery")(function* (
  target: TestDeployment,
  key: string
) {
  return yield* target.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const found = yield* reader
        .table("billingEvents")
        .index("by_rail_and_key", (query) =>
          query.eq("rail", "polar").eq("key", key)
        )
        .first()
        .pipe(Effect.orDie);
      return Option.getOrNull(found);
    }),
    StoredDelivery
  );
});

beforeEach(() => {
  vi.stubEnv("POLAR_WEBHOOK_SECRET", WEBHOOK_SECRET);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("routes/polar", () => {
  it.effect(
    "stores a signed delivery in the billing inbox and acknowledges it",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        const response = yield* postSigned(target, subscriptionBody);
        expect(response.status).toBe(202);
        expect(yield* storedDelivery(target, DELIVERY_ID)).toMatchObject({
          rail: "polar",
          key: DELIVERY_ID,
          type: "subscription.created",
          payload: subscriptionBody,
          processedAt: null,
        });
      })
  );

  it.effect(
    "acknowledges a redelivery of a stored delivery without storing it twice",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        expect((yield* postSigned(target, subscriptionBody)).status).toBe(202);
        expect((yield* postSigned(target, subscriptionBody)).status).toBe(202);
        const count = yield* target.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const rows = yield* reader
              .table("billingEvents")
              .index("by_receivedAt")
              .take(10)
              .pipe(Effect.orDie);
            return rows.length;
          }),
          Schema.Finite
        );
        expect(count).toBe(1);
      })
  );

  it.effect("refuses a delivery whose signature does not match", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      const headers = yield* Effect.promise(() =>
        signWebhook(subscriptionBody)
      );
      const response = yield* postWebhook(
        target,
        encodeJsonText({ data: {}, type: "subscription.updated" }),
        headers
      );
      expect(response.status).toBe(403);
    })
  );

  it.effect(
    "acknowledges a signed event type the SDK does not know without storing it",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        const body = encodeJsonText({ data: {}, type: "unknown.future.event" });
        const response = yield* postSigned(target, body, "msg_unknown_event");
        expect(response.status).toBe(202);
        expect(yield* storedDelivery(target, "msg_unknown_event")).toBeNull();
      })
  );

  it.effect("rejects a signed body that carries no event type", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      const response = yield* postSigned(
        target,
        encodeJsonText({ data: {} }),
        "msg_no_type"
      );
      expect(response.status).toBe(400);
    })
  );

  it.effect("fails a signed body that is not JSON as an SDK failure", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      const response = yield* postSigned(target, "not json", "msg_not_json");
      expect(response.status).toBe(500);
    })
  );

  it.effect(
    "refuses a delivery that arrives without its delivery headers",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        const response = yield* postWebhook(target, subscriptionBody, {
          "content-type": "application/json",
        });
        expect(response.status).toBe(403);
      })
  );
});

describe("routes/polar body", () => {
  it.effect("answers 500 when the body cannot be read", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      const headers = yield* Effect.promise(() =>
        signWebhook(subscriptionBody)
      );
      const readBody = vi
        .spyOn(Request.prototype, "text")
        .mockRejectedValueOnce(new Error("body stream failed"));
      const response = yield* postWebhook(target, subscriptionBody, headers);
      readBody.mockRestore();
      expect(response.status).toBe(500);
    })
  );

  it.effect("answers 500 when the webhook secret is not configured", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      vi.stubEnv("POLAR_WEBHOOK_SECRET", "");
      const response = yield* postSigned(
        target,
        subscriptionBody,
        "msg_no_secret"
      );
      expect(response.status).toBe(500);
    })
  );
});
