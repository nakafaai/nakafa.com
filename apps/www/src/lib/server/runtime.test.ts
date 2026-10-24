// @vitest-environment node
import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { runtime } from "@/lib/server/runtime";

describe("server runtime", () => {
  it("sends no trace headers, even from inside a span", async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("{}"))
    );
    await runtime.runPromise(
      HttpClient.get("https://example.com/status").pipe(
        Effect.withSpan("probe"),
        Effect.provideService(FetchHttpClient.Fetch, fetcher)
      )
    );
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.has("traceparent")).toBe(false);
    expect(headers.has("b3")).toBe(false);
  });
});

describe("server runtime startup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("refuses to load a non-production stage that points at the production content runtime", async () => {
    vi.stubEnv("NAKAFA_DEPLOY_STAGE", "staging");
    vi.stubEnv("VITE_CONVEX_URL", "https://dapper-antelope-269.convex.cloud");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://dapper-antelope-269.convex.site");
    vi.resetModules();

    await expect(import("@/lib/server/runtime")).rejects.toThrow(
      "Production content is restricted to the protected production stage"
    );
  });
});
