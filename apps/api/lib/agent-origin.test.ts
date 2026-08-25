import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_CONVEX_SITE_URL_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyPublicApiRequest } from "@/lib/agent-origin";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("local public API adapter", () => {
  it("forwards local requests to the selected Convex deployment", async () => {
    vi.stubEnv(
      NAKAFA_CONVEX_SITE_URL_ENVIRONMENT,
      "https://isolated.convex.site"
    );
    vi.stubEnv(NAKAFA_API_EDGE_CONTRACT.secretEnvironment, "local-api-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ name: "Nakafa Public API" })))
    );

    const response = await proxyPublicApiRequest(
      new Request("http://localhost:3002/v1")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      name: "Nakafa Public API",
    });
  });

  it.each([
    {
      configure() {
        vi.stubEnv(NAKAFA_CONVEX_SITE_URL_ENVIRONMENT, "");
        vi.stubEnv(NAKAFA_API_EDGE_CONTRACT.secretEnvironment, "");
      },
      expectedCode: "LOCAL_PROXY_CONFIGURATION_MISSING",
      request: () => new Request("http://localhost:3002/v1"),
      status: 503,
    },
    {
      configure() {
        vi.stubEnv(
          NAKAFA_CONVEX_SITE_URL_ENVIRONMENT,
          "https://isolated.convex.site"
        );
        vi.stubEnv(
          NAKAFA_API_EDGE_CONTRACT.secretEnvironment,
          "local-api-secret"
        );
      },
      expectedCode: "NOT_FOUND",
      request: () => new Request("http://localhost:3002/not-v1"),
      status: 404,
    },
    {
      configure() {
        vi.stubEnv(
          NAKAFA_CONVEX_SITE_URL_ENVIRONMENT,
          "https://isolated.convex.site"
        );
        vi.stubEnv(
          NAKAFA_API_EDGE_CONTRACT.secretEnvironment,
          "local-api-secret"
        );
        vi.stubEnv("VERCEL_ENV", "production");
      },
      expectedCode: "LOCAL_PROXY_DISABLED",
      request: () => new Request("https://api.nakafa.com/v1"),
      status: 503,
    },
    {
      configure() {
        vi.stubEnv(
          NAKAFA_CONVEX_SITE_URL_ENVIRONMENT,
          "https://isolated.convex.site"
        );
        vi.stubEnv(
          NAKAFA_API_EDGE_CONTRACT.secretEnvironment,
          "local-api-secret"
        );
      },
      expectedCode: "PAYLOAD_TOO_LARGE",
      request: () =>
        new Request("http://localhost:3002/v1", {
          body: new Uint8Array(2 * 1024 * 1024 + 1),
          method: "POST",
        }),
      status: 413,
    },
    {
      configure() {
        vi.stubEnv(
          NAKAFA_CONVEX_SITE_URL_ENVIRONMENT,
          "https://isolated.convex.site"
        );
        vi.stubEnv(
          NAKAFA_API_EDGE_CONTRACT.secretEnvironment,
          "local-api-secret"
        );
      },
      expectedCode: "LOCAL_PROXY_UNAVAILABLE",
      request: () => new Request("http://localhost:3002/v1"),
      status: 503,
    },
  ])(
    "returns Problem Details $expectedCode for a local adapter failure",
    async ({ configure, expectedCode, request, status }) => {
      configure();
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("unavailable")))
      );

      const response = await proxyPublicApiRequest(request());
      const body = await response.json();

      expect(response.status).toBe(status);
      expect(response.headers.get("content-type")).toContain(
        "application/problem+json"
      );
      expect(body).toMatchObject({
        code: expectedCode,
        instance: new URL(request().url).pathname,
        status,
      });
      expect(body.request_id).toEqual(expect.any(String));
    }
  );
});
