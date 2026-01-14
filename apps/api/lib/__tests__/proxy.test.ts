import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

const VALID_API_KEY = "test-api-key-12345";
const INVALID_API_KEY = "wrong-api-key";

describe("proxy middleware", () => {
  beforeAll(() => {
    vi.stubEnv("INTERNAL_CONTENT_API_KEY", VALID_API_KEY);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

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
            Authorization: `Bearer ${INVALID_API_KEY}`,
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
            Authorization: `Bearer ${VALID_API_KEY}`,
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
            Authorization: `Bearer ${VALID_API_KEY}`,
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
            Authorization: `Bearer ${VALID_API_KEY}`,
            origin: "https://nakafa.com",
          },
        }
      );

      const response = proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });
  });
});
