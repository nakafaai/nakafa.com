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
    expect(response.headers.get("access-control-expose-headers")).toBe("ETag");
    expect(await response.text()).toContain('"openapi":"3.1.1"');
    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get("etag")).toBe(NAKAFA_OPENAPI_ETAG);
    expect(revalidated.headers.get("access-control-expose-headers")).toBe(
      "ETag"
    );
  });

  it("uses weak comparison across If-None-Match validator lists", () => {
    const strongEntityTag = NAKAFA_OPENAPI_ETAG.slice("W/".length);
    const listed = createOpenApiResponse(
      `, "older,validator" \t, ${strongEntityTag}`
    );
    const wildcard = createOpenApiResponse("\t* ");

    expect(listed.status).toBe(304);
    expect(wildcard.status).toBe(304);
  });

  it("ignores malformed or unbounded If-None-Match values", () => {
    const invalidValues = [
      " \t",
      '"different"',
      "not-an-entity-tag",
      '"unterminated',
      '"invalid\u0001value"',
      `"older" suffix, ${NAKAFA_OPENAPI_ETAG}`,
      `${NAKAFA_OPENAPI_ETAG}, invalid`,
      `${", ".repeat(33)}${NAKAFA_OPENAPI_ETAG}`,
    ];

    for (const value of invalidValues) {
      expect(createOpenApiResponse(value).status).toBe(200);
    }
  });

  it("serves a public read-only CORS preflight", () => {
    const response = createOpenApiOptionsResponse();

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, HEAD, OPTIONS"
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Accept, If-None-Match"
    );
  });
});
