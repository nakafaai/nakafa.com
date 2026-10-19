// @vitest-environment node
import { HttpClient as ConfectHttpClient } from "@confect/js";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { runtime } from "@/lib/server/runtime";

/** The deployment that the runtime reads from its environment. */
const CONVEX_URL = "https://example.convex.cloud";

process.env.VITE_CONVEX_URL = CONVEX_URL;

describe("server runtime", () => {
  it("provides the Confect client of the configured deployment", async () => {
    const client = await runtime.runPromise(ConfectHttpClient.HttpClient);
    expect(client.url).toBe(CONVEX_URL);
  });

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
