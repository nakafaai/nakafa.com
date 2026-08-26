import {
  NAKAFA_OPENAPI_ETAG,
  NAKAFA_OPENAPI_JSON,
} from "@repo/backend/agent/openapi/document";
import {
  createOpenApiOptionsResponse,
  createOpenApiResponse,
} from "@repo/backend/agent/openapi/response";
import { describe, expect, it } from "vitest";

const WEAK_ETAG_PREFIX = /^W\//;

describe("Nakafa OpenAPI response", () => {
  it("returns exact contract bytes and cache metadata", async () => {
    const response = createOpenApiResponse();

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe(NAKAFA_OPENAPI_ETAG);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=3600"
    );
    await expect(response.text()).resolves.toBe(NAKAFA_OPENAPI_JSON);
  });

  it.each([
    NAKAFA_OPENAPI_ETAG,
    NAKAFA_OPENAPI_ETAG.replace(WEAK_ETAG_PREFIX, ""),
    `"different", ${NAKAFA_OPENAPI_ETAG}`,
    "*",
  ])("uses weak entity-tag matching for %s", (ifNoneMatch) => {
    const response = createOpenApiResponse(ifNoneMatch);

    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe(NAKAFA_OPENAPI_ETAG);
  });

  it.each([
    "malformed",
    'W/"unterminated',
    `${NAKAFA_OPENAPI_ETAG} trailing`,
    Array.from({ length: 33 }, (_, index) => `"tag-${index}"`).join(","),
  ])("ignores invalid or excessive validators", (ifNoneMatch) => {
    expect(createOpenApiResponse(ifNoneMatch).status).toBe(200);
  });

  it("returns the exact read-only preflight", () => {
    const response = createOpenApiOptionsResponse();

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS"
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
