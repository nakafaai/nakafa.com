import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { ConfigProvider, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bridgePublicApi, bridgePublicApiRequest } from "@/lib/bridge";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubEnv("NAKAFA_API_EDGE_SECRET", "test-api-edge-secret");
  vi.stubEnv("NAKAFA_CONVEX_SITE_URL", "https://test.convex.site");
});

describe("public Quran API bridge", () => {
  it("forwards the exact path, query, method, and allowlisted headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
          ETag: 'W/"quran-v2"',
          "Set-Cookie": "private=value",
          Vary: "Accept, Accept-Encoding",
        },
        status: 206,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await bridgePublicApiRequest(
      new Request(
        "https://api.nakafa.com/quran/2?locale=id&include_tafsir=true",
        {
          headers: {
            accept: "application/json",
            authorization: "Bearer private-user-token",
            cookie: "private=session",
            "if-none-match": 'W/"previous"',
            [NAKAFA_API_EDGE_CONTRACT.secretHeader]: "attacker-value",
            traceparent: "00-trace-parent",
            "x-forwarded-for": "203.0.113.9",
          },
        }
      )
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://test.convex.site/internal/agent/quran/2?locale=id&include_tafsir=true"
    );
    expect(init).toMatchObject({
      cache: "no-store",
      method: "GET",
      redirect: "manual",
    });
    const headers = new Headers(init?.headers);
    expect(headers.get(NAKAFA_API_EDGE_CONTRACT.secretHeader)).toBe(
      "test-api-edge-secret"
    );
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("if-none-match")).toBe('W/"previous"');
    expect(headers.get("traceparent")).toBe("00-trace-parent");
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.9");
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
    expect(response.status).toBe(206);
    expect(response.headers.get("etag")).toBe('W/"quran-v2"');
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("preserves preflight, cache, retry, and validator responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            "Access-Control-Allow-Headers": "Accept, If-None-Match",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Origin": "*",
          },
          status: 204,
        })
      )
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
            ETag: 'W/"openapi"',
          },
          status: 304,
        })
      )
      .mockResolvedValueOnce(
        new Response("limited", {
          headers: { "Retry-After": "8" },
          status: 429,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const options = await bridgePublicApiRequest(
      new Request("https://api.nakafa.com/quran/1", {
        method: "OPTIONS",
      })
    );
    const cached = await bridgePublicApiRequest(
      new Request("https://api.nakafa.com/openapi.json")
    );
    const limited = await bridgePublicApiRequest(
      new Request("https://api.nakafa.com/quran/1")
    );

    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS"
    );
    expect(cached.status).toBe(304);
    expect(cached.headers.get("cache-control")).toContain("s-maxage=3600");
    expect(cached.headers.get("etag")).toBe('W/"openapi"');
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("8");
  });

  it("fails closed without leaking transport or credential details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private origin failure"))
    );

    const response = await bridgePublicApiRequest(
      new Request("https://api.nakafa.com/quran/1")
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      code: "EDGE_SERVICE_UNAVAILABLE",
      instance: "/quran/1",
      request_id: expect.any(String),
      status: 503,
    });
    expect(JSON.stringify(body)).not.toContain("private origin failure");
    expect(JSON.stringify(body)).not.toContain("test-api-edge-secret");
  });

  it("isolates missing bridge configuration from existing API routes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await Effect.runPromise(
      bridgePublicApi(new Request("https://api.nakafa.com/quran/1")).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnvRecord({
            NAKAFA_CONVEX_SITE_URL: "https://test.convex.site",
          })
        )
      )
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      code: "EDGE_SERVICE_UNAVAILABLE",
      instance: "/quran/1",
      status: 503,
    });
    expect(JSON.stringify(body)).not.toContain("NAKAFA_API_EDGE_SECRET");
  });

  it("does not become a generic origin proxy", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await bridgePublicApiRequest(
      new Request("https://api.nakafa.com/v1")
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      code: "ENDPOINT_NOT_FOUND",
      instance: "/v1",
    });
  });
});
