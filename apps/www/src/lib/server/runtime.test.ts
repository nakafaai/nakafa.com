// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
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
