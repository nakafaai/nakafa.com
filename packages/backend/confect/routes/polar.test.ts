// @vitest-environment edge-runtime

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror";
import { WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect, Schema } from "effect";

const mocks = vi.hoisted(() => ({
  processEvent: vi.fn(),
  validateEvent: vi.fn(),
}));

class TestProcessingError extends Schema.TaggedError<TestProcessingError>()(
  "TestProcessingError",
  { message: Schema.String }
) {}

vi.mock("@polar-sh/sdk/webhooks", async (importOriginal) => ({
  ...(await importOriginal()),
  validateEvent: mocks.validateEvent,
}));

vi.mock("@repo/backend/confect/customers/polar/webhook", () => ({
  processPolarWebhookEvent: mocks.processEvent,
}));

const postWebhook = Effect.fn("routes.polar.test.postWebhook")(function* (
  body = "{}"
) {
  const target = yield* Confect.pipe(Effect.provide(confectLayer));
  return yield* target.fetch("/polar/events", {
    body,
    headers: { "content-type": "application/json" },
    method: "POST",
  });
});

const readResponseText = Effect.fn("routes.polar.test.readResponseText")(
  (response: Response) => Effect.promise(() => response.text())
);

beforeEach(() => {
  mocks.validateEvent.mockReset();
  mocks.processEvent.mockReset();
  mocks.validateEvent.mockReturnValue({ type: "test.event" });
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
        const response = yield* postWebhook();
        expect(response.status).toBe(500);
        expect(mocks.validateEvent).not.toHaveBeenCalled();
        expect(mocks.processEvent).not.toHaveBeenCalled();
      })
  );

  it.effect("accepts one verified and handled event", () =>
    Effect.gen(function* () {
      const response = yield* postWebhook('{"type":"test.event"}');

      expect(response.status).toBe(202);
      expect(yield* readResponseText(response)).toBe("Accepted");
      expect(mocks.processEvent).toHaveBeenCalledOnce();
    })
  );

  it.effect("returns a retryable bad request for a missing user", () =>
    Effect.gen(function* () {
      mocks.processEvent.mockReturnValue(Effect.succeed(false));

      const response = yield* postWebhook();

      expect(response.status).toBe(400);
      expect(yield* readResponseText(response)).toBe(
        "Bad Request: Missing User"
      );
    })
  );

  it.effect("rejects an invalid signature before processing", () =>
    Effect.gen(function* () {
      mocks.validateEvent.mockImplementation(() => {
        throw new WebhookVerificationError("Invalid signature");
      });

      const response = yield* postWebhook();

      expect(response.status).toBe(403);
      expect(yield* readResponseText(response)).toBe("Forbidden");
      expect(mocks.processEvent).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects a signed malformed payload before processing", () =>
    Effect.gen(function* () {
      mocks.validateEvent.mockImplementation(() => {
        throw new SDKValidationError("Invalid payload", undefined, {});
      });

      const response = yield* postWebhook();

      expect(response.status).toBe(400);
      expect(yield* readResponseText(response)).toBe("Bad Request");
      expect(mocks.processEvent).not.toHaveBeenCalled();
    })
  );

  it.effect("maps an unexpected SDK failure to a server response", () =>
    Effect.gen(function* () {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      mocks.validateEvent.mockImplementation(() => {
        throw new Error("Unexpected SDK failure");
      });

      const response = yield* postWebhook();

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
      expect(mocks.validateEvent).not.toHaveBeenCalled();
      expect(mocks.processEvent).not.toHaveBeenCalled();
    })
  );

  it.effect("maps typed processing failures to a server response", () =>
    Effect.gen(function* () {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      mocks.processEvent.mockReturnValue(
        Effect.fail(new TestProcessingError({ message: "Database down" }))
      );

      const response = yield* postWebhook();

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

      const response = yield* postWebhook();

      expect(response.status).toBe(500);
      expect(yield* readResponseText(response)).toBe("Internal server error");
    })
  );
});
