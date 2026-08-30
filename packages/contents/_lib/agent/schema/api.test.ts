import { describe, expect, it } from "@effect/vitest";
import {
  NakafaApiHealthSchema,
  NakafaApiIndexSchema,
  NakafaProblemDetailsSchema,
} from "@repo/contents/_lib/agent/schema/api";
import { Schema } from "effect";

describe("Nakafa public API schemas", () => {
  it("accepts the stable index and health contracts", () => {
    expect(
      Schema.is(NakafaApiIndexSchema)({
        authentication: "none",
        description: "Signed educational content.",
        documentation: "https://nakafa.com/developers",
        mcp: "https://mcp.nakafa.com/mcp",
        name: "Nakafa Public API",
        openapi: "https://api.nakafa.com/openapi.json",
        status: "active",
        version: "2.0.0",
      })
    ).toBe(true);
    expect(
      Schema.is(NakafaApiHealthSchema)({
        service: "nakafa-public-api",
        status: "ok",
        timestamp: 1,
        version: "2.0.0",
      })
    ).toBe(true);
  });

  it("requires HTTPS links and an HTTP error status", () => {
    expect(
      Schema.is(NakafaApiIndexSchema)({
        authentication: "none",
        description: "Signed educational content.",
        documentation: "http://nakafa.com/developers",
        mcp: "https://mcp.nakafa.com/mcp",
        name: "Nakafa Public API",
        openapi: "https://api.nakafa.com/openapi.json",
        status: "active",
        version: "2.0.0",
      })
    ).toBe(false);
    expect(
      Schema.is(NakafaProblemDetailsSchema)({
        code: "INVALID_REQUEST",
        detail: "Invalid input.",
        instance: "/search",
        request_id: "request-1",
        resolution: "Correct the input.",
        status: 200,
        title: "Invalid request",
        type: "https://nakafa.com/problems/invalid-request",
      })
    ).toBe(false);
  });
});
