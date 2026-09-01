import { GatewayInternalServerError } from "@ai-sdk/gateway";
import { describe, expect, it } from "@effect/vitest";
import { getGatewayErrorContext } from "@repo/ai/config/gateway-error";

describe("Gateway error context", () => {
  it("extracts Gateway metadata for production log correlation", () => {
    const error = new GatewayInternalServerError({
      generationId: "gw_123",
    });

    expect(getGatewayErrorContext(error)).toEqual({
      gatewayErrorType: "internal_server_error",
      gatewayGenerationId: "gw_123",
      gatewayRetryable: true,
      gatewayStatusCode: 500,
    });
  });

  it("ignores non-Gateway errors", () => {
    expect(getGatewayErrorContext(new Error("regular error"))).toEqual({});
  });
});
