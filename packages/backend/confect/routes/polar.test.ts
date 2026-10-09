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
import { encodeJsonText } from "@repo/utilities/json";
import { DateTime, Effect, Schema } from "effect";

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
async function signWebhook(body: string, secret = WEBHOOK_SECRET) {
  const id = "msg_route_test";
  const timestamp = String(
    Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / 1000)
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
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

/** Sends one signed customer deletion through the route, inside the deployment the test provides. */
const postDeletion = Effect.fn("routes.polar.test.postDeletion")(function* (
  data: unknown
) {
  const target = yield* Confect;
  const body = encodeJsonText({ data, type: "customer.deleted" });
  const headers = yield* Effect.promise(() => signWebhook(body));
  return yield* target.fetch("/polar/events", {
    body,
    headers,
    method: "POST",
  });
});

/** Stores the local customer row that a Polar customer deletion removes. */
const seedPolarCustomer = Effect.fn("routes.polar.test.seedPolarCustomer")(
  function* () {
    const target = yield* Confect;
    yield* target.run(
      Effect.gen(function* () {
        const writer = yield* DatabaseWriter;
        const userId = yield* writer.table("users").insert({
          authId: "auth-deletion",
          credits: 0,
          creditsResetAt: 1,
          email: "deletion@example.com",
          name: "Deletion",
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
  }
);

/** Counts the customer rows that remain in the deployment. */
const countCustomers = Effect.fn("routes.polar.test.countCustomers")(
  function* () {
    const target = yield* Confect;
    return yield* target.run(
      Effect.flatMap(DatabaseReader, (reader) =>
        reader.table("customers").index("by_polarId").take(10)
      ).pipe(Effect.map((customers) => customers.length)),
      Schema.Int
    );
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
    "rejects a signature made with another secret before processing",
    () =>
      Effect.gen(function* () {
        const body = '{"type":"customer.updated"}';
        const headers = yield* Effect.promise(() =>
          signWebhook(body, "polar_another_secret")
        );

        const response = yield* postWebhook(body, headers);

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

  it.effect("answers 500 to a signed body that is not JSON", () =>
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
          PolarPayloadError.make({
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
        Effect.fail(TestProcessingError.make({ message: "Database down" }))
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
        encodeJsonText({
          data: { ...polarCustomer, email: undefined },
          type: "customer.created",
        })
      );

      expect(response.status).toBe(400);
      expect(yield* readResponseText(response)).toBe("Bad Request");
    })
  );

  it.effect("rejects a team customer created without an email", () =>
    Effect.gen(function* () {
      const response = yield* postSignedWebhook(
        encodeJsonText({
          data: { ...polarCustomer, email: null, type: "team" },
          type: "customer.created",
        })
      );

      expect(response.status).toBe(400);
      expect(yield* readResponseText(response)).toBe("Bad Request");
    })
  );

  it.effect(
    "acknowledges a malformed body of a known event type Nakafa does not handle with 202",
    () =>
      Effect.gen(function* () {
        const response = yield* postSignedWebhook(
          encodeJsonText({ data: {}, type: "order.created" })
        );

        expect(response.status).toBe(202);
        expect(yield* readResponseText(response)).toBe("Accepted");
      })
  );

  it.effect(
    "processes a customer deletion whose other fields are malformed and deletes the customer",
    () =>
      Effect.gen(function* () {
        yield* seedPolarCustomer();

        const response = yield* postDeletion({
          ...polarCustomer,
          created_at: "2026-09-01",
        });

        expect(response.status).toBe(202);
        expect(yield* readResponseText(response)).toBe("Accepted");
        expect(yield* countCustomers()).toBe(0);
      }).pipe(Effect.provide(confectLayer))
  );

  it.effect(
    "processes a customer deletion that carries only the customer id",
    () =>
      Effect.gen(function* () {
        yield* seedPolarCustomer();

        const response = yield* postDeletion({ id: polarCustomer.id });

        expect(response.status).toBe(202);
        expect(yield* readResponseText(response)).toBe("Accepted");
        expect(yield* countCustomers()).toBe(0);
      }).pipe(Effect.provide(confectLayer))
  );

  it.effect("rejects a customer deletion without a customer id", () =>
    Effect.gen(function* () {
      const response = yield* postDeletion({ email: polarCustomer.email });

      expect(response.status).toBe(400);
      expect(yield* readResponseText(response)).toBe("Bad Request");
    }).pipe(Effect.provide(confectLayer))
  );

  it.effect("rejects a subscription whose amount is not an integer", () =>
    Effect.gen(function* () {
      const response = yield* postSignedWebhook(
        encodeJsonText({
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
          encodeJsonText({
            data: { ...polarSubscription, prices: "not read" },
            type: "subscription.updated",
          })
        );

        expect(response.status).toBe(202);
        expect(yield* readResponseText(response)).toBe("Accepted");
      })
  );
});
