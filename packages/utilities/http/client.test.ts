import { describe, expect, it } from "@effect/vitest";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, type Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";

/** Sends one request through a client and returns the fetch that received it. */
const send = Effect.fn("test.send")(function* (
  client: Layer.Layer<HttpClient.HttpClient>
) {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 204 }));
  yield* HttpClient.get("https://example.com/", {
    headers: { accept: "text/plain" },
  }).pipe(
    Effect.provide(client),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
  return fetcher;
});

describe("FetchClient", () => {
  it.effect("sends only the headers its caller set", () =>
    Effect.gen(function* () {
      expect(yield* send(FetchClient)).toHaveBeenCalledWith(
        new URL("https://example.com/"),
        expect.objectContaining({ headers: { accept: "text/plain" } })
      );
    })
  );

  it.effect("exists because Effect's own layer adds trace headers", () =>
    Effect.gen(function* () {
      expect(yield* send(FetchHttpClient.layer)).toHaveBeenCalledWith(
        new URL("https://example.com/"),
        expect.objectContaining({
          headers: expect.objectContaining({
            b3: expect.any(String),
            traceparent: expect.any(String),
          }),
        })
      );
    })
  );
});
