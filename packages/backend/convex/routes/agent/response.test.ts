// @vitest-environment node
import {
  internalFailureResponse,
  problemResponse,
} from "@repo/backend/convex/routes/agent/response";
import { describe, expect, it } from "vitest";

describe("agent HTTP responses", () => {
  it("builds the documented rate-limit Problem Details contract", async () => {
    const response = problemResponse({
      code: "RATE_LIMITED",
      detail: "The public request limit was exceeded.",
      instance: "/v1/search",
      requestId: "request-429",
      resolution: "Retry after the platform rate-limit window.",
      status: 429,
      title: "Too many requests",
      type: "rate-limited",
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      code: "RATE_LIMITED",
      detail: "The public request limit was exceeded.",
      instance: "/v1/search",
      request_id: "request-429",
      resolution: "Retry after the platform rate-limit window.",
      status: 429,
      title: "Too many requests",
      type: "https://nakafa.com/problems/rate-limited",
    });
  });

  it("keeps unexpected failures traceable without exposing their cause", async () => {
    const response = internalFailureResponse("/v1/search", "request-500");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      code: "INTERNAL_ERROR",
      instance: "/v1/search",
      request_id: "request-500",
      status: 500,
    });
  });
});
