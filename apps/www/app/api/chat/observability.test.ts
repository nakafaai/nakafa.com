// @vitest-environment node

import { ModelIdSchema } from "@repo/ai/config/model";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChatErrorReporter } from "@/app/api/chat/observability";

const observabilityMocks = vi.hoisted(() => ({
  captureServerException: vi.fn(),
  getGatewayErrorContext: vi.fn(),
  logError: vi.fn(),
  pending: [] as Promise<unknown>[],
}));

vi.mock("@repo/ai/config/gateway-error", () => ({
  getGatewayErrorContext: observabilityMocks.getGatewayErrorContext,
}));

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException: observabilityMocks.captureServerException,
}));

vi.mock("@repo/utilities/logging/effect", async () => {
  const { Effect } = await import("effect");

  return {
    logError: (...args: unknown[]) => {
      observabilityMocks.logError(...args);
      return Effect.void;
    },
  };
});

vi.mock("@vercel/functions", () => ({
  waitUntil: (pending: Promise<unknown>) => {
    observabilityMocks.pending.push(pending);
  },
}));

describe("chat stream observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observabilityMocks.pending.length = 0;
    observabilityMocks.captureServerException.mockResolvedValue(undefined);
    observabilityMocks.getGatewayErrorContext.mockReturnValue({});
  });

  it("reports operational fields without account or chat identity", async () => {
    const modelId = ModelIdSchema.make("nakafa-lite");
    const error = new Error("generation failed");
    const report = createChatErrorReporter({
      chatId: "chat-123" as Id<"chats">,
      logContext: {
        currentPage: "/id/user/private",
        userId: "user-123",
      },
      modelId,
    });

    report(error, "stream-on-error");
    await Promise.all(observabilityMocks.pending);

    expect(observabilityMocks.captureServerException).toHaveBeenCalledWith(
      error,
      {
        error_location: "stream-on-error",
        gateway_model_id: "openai/gpt-5-mini",
        model_id: modelId,
        source: "chat-api",
      }
    );
    expect(
      JSON.stringify(observabilityMocks.captureServerException.mock.calls)
    ).not.toContain("user-123");
    expect(
      JSON.stringify(observabilityMocks.captureServerException.mock.calls)
    ).not.toContain("chat-123");
  });

  it("contains provider failure and records it in service logs", async () => {
    observabilityMocks.captureServerException.mockRejectedValue(
      new Error("provider unavailable")
    );
    observabilityMocks.getGatewayErrorContext.mockReturnValue({
      gatewayErrorType: "rate_limit",
      gatewayGenerationId: "generation-123",
      gatewayRetryable: true,
      gatewayStatusCode: 429,
    });
    const report = createChatErrorReporter({
      chatId: "chat-123" as Id<"chats">,
      logContext: { service: "chat-api" },
      modelId: ModelIdSchema.make("nakafa-lite"),
    });

    report("generation failed", "stream-on-error");

    await expect(
      Promise.all(observabilityMocks.pending)
    ).resolves.toBeDefined();
    expect(observabilityMocks.captureServerException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "generation failed" }),
      {
        error_location: "stream-on-error",
        gateway_error_type: "rate_limit",
        gateway_model_id: "openai/gpt-5-mini",
        gateway_retryable: true,
        gateway_status_code: 429,
        model_id: "nakafa-lite",
        source: "chat-api",
      }
    );
    expect(observabilityMocks.logError).toHaveBeenCalledTimes(2);
  });
});
