import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
} from "@repo/backend/agent/edge";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server.js";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

function requestProxy(pathname: string, headers?: HeadersInit) {
  return proxy(
    new NextRequest(`https://api.nakafa.com${pathname}`, { headers })
  );
}

describe("proxy middleware", () => {
  describe("authentication", () => {
    it("should reject request without Authorization header", async () => {
      const request = new NextRequest(
        "http://localhost:3000/contents/en/articles"
      );

      const response = proxy(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    });

    it("should reject request with invalid Authorization format", async () => {
      const request = new NextRequest(
        "http://localhost:3000/contents/en/articles",
        {
          headers: {
            Authorization: "InvalidFormat",
          },
        }
      );

      const response = proxy(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    });

    it("should reject request with wrong API key", async () => {
      const request = new NextRequest(
        "http://localhost:3000/contents/en/articles",
        {
          headers: {
            Authorization: "Bearer wrong-api-key",
          },
        }
      );

      const response = proxy(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    });

    it("should allow request with correct API key", () => {
      const request = new NextRequest(
        "http://localhost:3000/contents/en/articles",
        {
          headers: {
            Authorization: "Bearer test-api-key-12345",
          },
        }
      );

      const response = proxy(request);

      expect(response.status).toBe(200);
    });

    it("should allow OPTIONS request with valid API key (server-side preflight)", () => {
      const request = new NextRequest(
        "http://localhost:3000/contents/en/articles",
        {
          method: "OPTIONS",
          headers: {
            Authorization: "Bearer test-api-key-12345",
          },
        }
      );

      const response = proxy(request);

      expect(response.status).toBe(200);
    });
  });

  describe("security", () => {
    it("should reject empty Bearer token", () => {
      const request = new NextRequest(
        "http://localhost:3000/contents/en/articles",
        {
          headers: {
            Authorization: "Bearer ",
          },
        }
      );

      const response = proxy(request);

      expect(response.status).toBe(401);
    });

    it("should handle Bearer without space", () => {
      const request = new NextRequest(
        "http://localhost:3000/contents/en/articles",
        {
          headers: {
            Authorization: "Bearertoken",
          },
        }
      );

      const response = proxy(request);

      expect(response.status).toBe(401);
    });

    it("should reject OPTIONS without Authorization (blocks browser preflight)", () => {
      const request = new NextRequest(
        "http://localhost:3000/contents/en/articles",
        {
          method: "OPTIONS",
        }
      );

      const response = proxy(request);

      expect(response.status).toBe(401);
    });

    it("should not include CORS headers in response", () => {
      const request = new NextRequest(
        "http://localhost:3000/contents/en/articles",
        {
          headers: {
            Authorization: "Bearer test-api-key-12345",
            origin: "https://nakafa.com",
          },
        }
      );

      const response = proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  describe("public agent API", () => {
    it("matches only the private content and public agent routes", () => {
      const matches = (url: string) =>
        unstable_doesMiddlewareMatch({ config, url });

      expect(
        [
          "/contents/en/articles",
          "/openapi.json",
          "/v1",
          "/v1/search",
          "/v2",
          "/v2/quran/1",
        ].every(matches)
      ).toBe(true);
      expect(["/", "/health", "/robots.txt"].some(matches)).toBe(false);
    });

    it.each([
      ["/openapi.json", "/internal/agent/openapi.json"],
      ["/v1/search?query=algebra", "/internal/agent/v1/search?query=algebra"],
      ["/v2/quran/2?locale=id", "/internal/agent/v2/quran/2?locale=id"],
    ])("rewrites %s to the protected Convex origin", (source, target) => {
      const response = requestProxy(source, {
        accept: "application/json",
        authorization: "Bearer private-user-token",
        cookie: "session=private",
        host: "hostile.example.com",
        "if-none-match": '"agent-contract"',
        [NAKAFA_API_EDGE_CONTRACT.secretHeader]: "hostile-secret",
        "x-forwarded-for": "203.0.113.10",
      });

      expect(response.headers.get("x-middleware-rewrite")).toBe(
        `https://test.convex.site${target}`
      );
      expect(response.headers.get(NAKAFA_EDGE_RELEASE_SHA_HEADER)).toBe(
        "a".repeat(40)
      );
      expect(
        response.headers.get(
          `x-middleware-request-${NAKAFA_API_EDGE_CONTRACT.secretHeader}`
        )
      ).toBe("test-api-edge-secret");
      expect(response.headers.get("x-middleware-request-accept")).toBe(
        "application/json"
      );
      expect(response.headers.get("x-middleware-request-if-none-match")).toBe(
        '"agent-contract"'
      );
      expect(response.headers.get("x-middleware-request-x-forwarded-for")).toBe(
        "203.0.113.10"
      );
      const forwarded = response.headers.get("x-middleware-override-headers");
      expect(forwarded).not.toContain("authorization");
      expect(forwarded).not.toContain("cookie");
      expect(forwarded).not.toContain("host");
    });
  });
});
