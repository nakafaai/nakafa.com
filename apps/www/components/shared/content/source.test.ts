import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { requestOpenContentSource } from "@/components/shared/content/source";

const SOURCE_PATH = "/en/subjects/mathematics/analytic-geometry/hyperbola.md";

/** Requests one source through the module's own client with a controlled fetch. */
function request(fetcher: typeof fetch) {
  return requestOpenContentSource(SOURCE_PATH).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

/** A rejected fetch with an Undici network code, as the library's fetch raises it. */
function networkFailure(code: string) {
  return new TypeError("fetch failed", {
    cause: Object.assign(new Error("private socket detail"), { code }),
  });
}

function neverAnswers() {
  return new Promise<Response>(() => undefined);
}

describe("requestOpenContentSource", () => {
  it.effect("answers with the published source text", () =>
    Effect.gen(function* () {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("## Published", { status: 200 }));

      expect(yield* request(fetcher)).toBe("## Published");
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "repeats a retryable network failure once, after 500 milliseconds",
    () =>
      Effect.gen(function* () {
        const fetcher = vi
          .fn<typeof fetch>()
          .mockRejectedValueOnce(networkFailure("ECONNRESET"))
          .mockResolvedValueOnce(new Response("## Published"));
        const fiber = yield* Effect.forkChild(request(fetcher));

        yield* TestClock.adjust("499 millis");
        expect(fetcher).toHaveBeenCalledOnce();
        yield* TestClock.adjust("1 millis");

        expect(yield* Fiber.join(fiber)).toBe("## Published");
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect("fails after three attempts miss their 10 second deadline", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(neverAnswers);
      const fiber = yield* Effect.forkChild(request(fetcher).pipe(Effect.flip));

      // Three attempts of ten seconds, with the 500 millisecond and 1 second waits.
      yield* TestClock.adjust("31500 millis");

      expect((yield* Fiber.join(fiber))._tag).toBe("OpenContentCopyError");
      expect(fetcher).toHaveBeenCalledTimes(3);
    })
  );

  it.effect("does not repeat a refused source", () =>
    Effect.gen(function* () {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 404 }));

      expect((yield* request(fetcher).pipe(Effect.flip)).code).toBe(
        "OPEN_CONTENT_SOURCE_REJECTED"
      );
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect("does not repeat an unreadable source body", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          new ReadableStream({
            /** Fails before the source body yields any bytes. */
            pull(controller) {
              controller.error(new Error("unreadable"));
            },
          }),
          { status: 200 }
        )
      );

      expect((yield* request(fetcher).pipe(Effect.flip)).code).toBe(
        "OPEN_CONTENT_SOURCE_READ_FAILED"
      );
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );
});
