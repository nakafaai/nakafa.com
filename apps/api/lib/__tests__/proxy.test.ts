import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

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
});
