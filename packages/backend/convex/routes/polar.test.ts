// @vitest-environment edge-runtime

import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror";
import { WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { registerPolarRoutes } from "@repo/backend/convex/routes/polar";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Schema } from "effect";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@repo/backend/convex/customers/polar/webhook", () => ({
  processPolarWebhookEvent: mocks.processEvent,
}));

function createApp() {
  const app: HonoWithConvex<ActionCtx> = new Hono();
  registerPolarRoutes(app);
  return app;
}

function postWebhook(body = "{}") {
  return createApp().request("/polar/events", {
    body,
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

beforeEach(() => {
  mocks.validateEvent.mockReset();
  mocks.processEvent.mockReset();
  mocks.validateEvent.mockReturnValue({ type: "test.event" });
  mocks.processEvent.mockReturnValue(Effect.succeed(true));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Polar webhook route", () => {
  it("accepts one verified and handled event", async () => {
    const response = await postWebhook('{"type":"test.event"}');

    expect(response.status).toBe(202);
    await expect(response.text()).resolves.toBe("Accepted");
    expect(mocks.processEvent).toHaveBeenCalledOnce();
  });

  it("returns a retryable bad request for a missing user", async () => {
    mocks.processEvent.mockReturnValue(Effect.succeed(false));

    const response = await postWebhook();

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Bad Request: Missing User");
  });

  it("rejects an invalid signature before processing", async () => {
    mocks.validateEvent.mockImplementation(() => {
      throw new WebhookVerificationError("Invalid signature");
    });

    const response = await postWebhook();

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe("Forbidden");
    expect(mocks.processEvent).not.toHaveBeenCalled();
  });

  it("rejects a signed malformed payload before processing", async () => {
    mocks.validateEvent.mockImplementation(() => {
      throw new SDKValidationError("Invalid payload", undefined, {});
    });

    const response = await postWebhook();

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Bad Request");
    expect(mocks.processEvent).not.toHaveBeenCalled();
  });

  it("maps an unexpected SDK failure to a server response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.validateEvent.mockImplementation(() => {
      throw new Error("Unexpected SDK failure");
    });

    const response = await postWebhook();

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("Internal server error");
    expect(mocks.processEvent).not.toHaveBeenCalled();
  });

  it("maps a body read failure to a server response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Request.prototype, "text").mockRejectedValue(
      new Error("Unreadable body")
    );

    const response = await postWebhook();

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("Internal server error");
    expect(mocks.validateEvent).not.toHaveBeenCalled();
    expect(mocks.processEvent).not.toHaveBeenCalled();
  });

  it("maps typed processing failures to a server response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.processEvent.mockReturnValue(
      Effect.fail(new TestProcessingError({ message: "Database down" }))
    );

    const response = await postWebhook();

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("Internal server error");
  });

  it("contains unexpected processing defects at the HTTP boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.processEvent.mockReturnValue(
      Effect.die(new Error("Unexpected processing defect"))
    );

    const response = await postWebhook();

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("Internal server error");
  });
});
