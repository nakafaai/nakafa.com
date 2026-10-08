// @vitest-environment edge-runtime

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { webhooks } from "@polar-sh/sdk/2026-10";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { polarGateway } from "@repo/backend/confect/customers/polar/live";
import { PolarPayloadError } from "@repo/backend/confect/customers/polar/payload";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { polarCustomer, polarSubscription } from "@repo/backend/test/polar";
import { Effect, Schema } from "effect";

const WEBHOOK_SECRET = "polar_webhook_route_test";

const mocks = vi.hoisted(() => ({
  processEvent: vi.fn(),
}));

class TestProcessingError extends Schema.TaggedError<TestProcessingError>()(
  "TestProcessingError",
  { message: Schema.String }
) {}

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

vi.mock("@repo/backend/confect/customers/polar/webhook", () => ({
  processPolarWebhookEvent: mocks.processEvent,
}));

vi.mock("@repo/backend/confect/customers/polar/live", () => ({
  polarGateway: { getCustomerById: vi.fn() },
}));

/** Signs a body the way Polar does, so the SDK verifies the signature for real. */
async function signWebhook(body: string) {
  const id = "msg_route_test";
  const timestamp = String(Math.floor(Date.now() / 1000));
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

const postWebhook = Effect.fn("routes.polar.test.postWebhook")(function* (
  body = "{}",
  headers: Record<string, string> = { "content-type": "application/json" }
) {
  const target = yield* Confect.pipe(Effect.provide(confectLayer));
  return yield* target.fetch("/polar/events", {
    body,
    headers,
    method: "POST",
  });
});

const postSignedWebhook = Effect.fn("routes.polar.test.postSignedWebhook")(
  function* (body: string) {
    const headers = yield* Effect.promise(() => signWebhook(body));
    return yield* postWebhook(body, headers);
  }
);

const readResponseText = Effect.fn("routes.polar.test.readResponseText")(
  (response: Response) => Effect.promise(() => response.text())
);

beforeEach(() => {
  vi.stubEnv("POLAR_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.mocked(webhooks.validateEvent).mockClear();
  mocks.processEvent.mockReset();
  mocks.processEvent.mockReturnValue(Effect.succeed(true));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Polar webhook route", () => {
  it.effect(
    "fails closed when signature verification has no configured secret",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("POLAR_WEBHOOK_SECRET", "");
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const response = yield* postSignedWebhook(
          '{"type":"customer.updated"}'
        );
        expect(response.status).toBe(500);
        expect(webhooks.validateEvent).not.toHaveBeenCalled();
        expect(mocks.processEvent).not.toHaveBeenCalled();
      })
  );

  it.effect("accepts one verified and handled event", () =>
    Effect.gen(function* () {
      const response = yield* postSignedWebhook('{"type":"customer.updated"}');

      expect(response.status).toBe(202);
      expect(yield* readResponseText(response)).toBe("Accepted");
      expect(mocks.processEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "customer.updated" })
      );
    })
  );

  it.effect("returns a retryable bad request for a missing user", () =>
    Effect.gen(function* () {
      mocks.processEvent.mockReturnValue(Effect.succeed(false));

      const response = yield* postSignedWebhook('{"type":"customer.updated"}');

      expect(response.status).toBe(400);
      expect(yield* readResponseText(response)).toBe(
        "Bad Request: Missing User"
      );
    })
  );

  it.effect("rejects an unsigned event before processing", () =>
    Effect.gen(function* () {
      const response = yield* postWebhook('{"type":"customer.updated"}');

      expect(response.status).toBe(403);
      expect(yield* readResponseText(response)).toBe("Forbidden");
      expect(mocks.processEvent).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "checks the signature before the event type, so an unsigned unknown type is forbidden",
    () =>
      Effect.gen(function* () {
        const response = yield* postWebhook('{"type":"unknown.event"}');

        expect(response.status).toBe(403);
        expect(mocks.processEvent).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "acknowledges a signed event of an unknown type with an empty 202",
    () =>
      Effect.gen(function* () {
        const response = yield* postSignedWebhook('{"type":"unknown.event"}');

        expect(response.status).toBe(202);
        expect(yield* readResponseText(response)).toBe("");
        expect(mocks.processEvent).not.toHaveBeenCalled();
      })
  );

  it.effect.each(["{}", '"abc"', '{"type":123}'])(
    "rejects a signed body without a string event type: %s",
    (body) =>
      Effect.gen(function* () {
        const response = yield* postSignedWebhook(body);

        expect(response.status).toBe(400);
        expect(yield* readResponseText(response)).toBe("Bad Request");
        expect(mocks.processEvent).not.toHaveBeenCalled();
      })
  );

  it.effect("maps a signed body that is not JSON to a server response", () =>
    Effect.gen(function* () {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const response = yield* postSignedWebhook("not json");

      expect(response.status).toBe(500);
      expect(yield* readResponseText(response)).toBe("Internal server error");
      expect(mocks.processEvent).not.toHaveBeenCalled();
    })
  );

  it.effect("maps a payload rejected during processing to a bad request", () =>
    Effect.gen(function* () {
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      mocks.processEvent.mockReturnValue(
        Effect.fail(
          new PolarPayloadError({
            cause: "malformed",
            message: "Polar customer payload does not match its contract.",
          })
        )
      );

      const response = yield* postSignedWebhook('{"type":"customer.updated"}');

      expect(response.status).toBe(400);
      expect(yield* readResponseText(response)).toBe("Bad Request");
    })
  );

  it.effect("maps an unexpected SDK failure to a server response", () =>
    Effect.gen(function* () {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.mocked(webhooks.validateEvent).mockRejectedValueOnce(
        new Error("Unexpected SDK failure")
      );

      const response = yield* postSignedWebhook('{"type":"customer.updated"}');

      expect(response.status).toBe(500);
      expect(yield* readResponseText(response)).toBe("Internal server error");
      expect(mocks.processEvent).not.toHaveBeenCalled();
    })
  );

  it.effect("maps a body read failure to a server response", () =>
    Effect.gen(function* () {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(Request.prototype, "text").mockRejectedValue(
        new Error("Unreadable body")
      );

      const response = yield* postWebhook();

      expect(response.status).toBe(500);
      expect(yield* readResponseText(response)).toBe("Internal server error");
      expect(webhooks.validateEvent).not.toHaveBeenCalled();
      expect(mocks.processEvent).not.toHaveBeenCalled();
    })
  );

  it.effect("maps typed processing failures to a server response", () =>
    Effect.gen(function* () {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      mocks.processEvent.mockReturnValue(
        Effect.fail(new TestProcessingError({ message: "Database down" }))
      );

      const response = yield* postSignedWebhook('{"type":"customer.updated"}');

      expect(response.status).toBe(500);
      expect(yield* readResponseText(response)).toBe("Internal server error");
    })
  );

  it.effect("contains unexpected processing defects at the HTTP boundary", () =>
    Effect.gen(function* () {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      mocks.processEvent.mockReturnValue(
        Effect.die(new Error("Unexpected processing defect"))
      );

      const response = yield* postSignedWebhook('{"type":"customer.updated"}');

      expect(response.status).toBe(500);
      expect(yield* readResponseText(response)).toBe("Internal server error");
    })
  );
});

describe("Polar webhook decoding at the route", () => {
  beforeEach(async () => {
    const { processPolarWebhookEvent } = await vi.importActual<
      typeof import("@repo/backend/confect/customers/polar/webhook")
    >("@repo/backend/confect/customers/polar/webhook");
    mocks.processEvent.mockImplementation(processPolarWebhookEvent);
    vi.mocked(polarGateway.getCustomerById).mockReturnValue(
      Effect.succeed(null)
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it.effect("rejects a customer created without an email", () =>
    Effect.gen(function* () {
      const response = yield* postSignedWebhook(
        JSON.stringify({
          data: { ...polarCustomer, email: undefined },
          type: "customer.created",
        })
      );

      expect(response.status).toBe(400);
      expect(yield* readResponseText(response)).toBe("Bad Request");
    })
  );

  it.effect(
    "rejects a customer deletion whose field is malformed and deletes nothing",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect;
        yield* target.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const userId = yield* writer.table("users").insert({
              authId: "auth-malformed",
              credits: 0,
              creditsResetAt: 1,
              email: "malformed@example.com",
              name: "Malformed",
              plan: "free",
            });
            yield* writer.table("customers").insert({
              externalId: null,
              id: polarCustomer.id,
              metadata: {},
              userId,
            });
          })
        );
        const body = JSON.stringify({
          data: { ...polarCustomer, created_at: "2026-09-01" },
          type: "customer.deleted",
        });
        const headers = yield* Effect.promise(() => signWebhook(body));
        const response = yield* target.fetch("/polar/events", {
          body,
          headers,
          method: "POST",
        });

        expect(response.status).toBe(400);
        expect(yield* readResponseText(response)).toBe("Bad Request");
        const remaining = yield* target.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("customers").index("by_polarId").take(10)
          ).pipe(Effect.map((customers) => customers.length)),
          Schema.Int
        );
        expect(remaining).toBe(1);
      }).pipe(Effect.provide(confectLayer))
  );

  it.effect("rejects a subscription whose amount is not an integer", () =>
    Effect.gen(function* () {
      const response = yield* postSignedWebhook(
        JSON.stringify({
          data: { ...polarSubscription, amount: 10.5 },
          type: "subscription.updated",
        })
      );

      expect(response.status).toBe(400);
      expect(yield* readResponseText(response)).toBe("Bad Request");
    })
  );

  it.effect(
    "accepts a subscription that carries a field Nakafa does not read",
    () =>
      Effect.gen(function* () {
        const response = yield* postSignedWebhook(
          JSON.stringify({
            data: { ...polarSubscription, prices: "not read" },
            type: "subscription.updated",
          })
        );

        expect(response.status).toBe(202);
        expect(yield* readResponseText(response)).toBe("Accepted");
      })
  );
});
