import { NAKAFA_OPENAPI_ETAG } from "@repo/backend/agent/openapi/document";
import {
  createOpenApiOptionsResponse,
  createOpenApiResponse,
} from "@repo/backend/agent/openapi/response";
import { describe, expect, it } from "vitest";

describe("OpenAPI HTTP response", () => {
  it("serves exact document bytes and revalidates by ETag", async () => {
    const response = createOpenApiResponse();
    const revalidated = createOpenApiResponse(NAKAFA_OPENAPI_ETAG);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8"
    );
    expect(response.headers.get("etag")).toBe(NAKAFA_OPENAPI_ETAG);
    expect(await response.text()).toContain('"openapi":"3.1.1"');
    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get("etag")).toBe(NAKAFA_OPENAPI_ETAG);
  });

  it("serves a public read-only CORS preflight", () => {
    const response = createOpenApiOptionsResponse();

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, HEAD, OPTIONS"
    );
  });
});
