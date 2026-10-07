import { describe, expect, it } from "@effect/vitest";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import {
  copyOpenContent,
  OpenContentCopyError,
} from "@/components/shared/content/copy";

const SOURCE_PATH = "/en/subjects/mathematics/analytic-geometry/hyperbola.md";
type CopyInput = Parameters<typeof copyOpenContent>[0];

/** Runs one copy through Effect's fetch client with a controlled fetch. */
function copy(input: CopyInput, fetcher: typeof fetch = vi.fn<typeof fetch>()) {
  return copyOpenContent(input).pipe(
    Effect.provide(FetchClient),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("copyOpenContent", () => {
  it.effect("copies inline preview source without a network request", () =>
    Effect.gen(function* () {
      const fetchMock = vi.fn<typeof fetch>();
      const writeClipboard = vi.fn(() => Promise.resolve());
      yield* copy({ content: "## Preview", writeClipboard }, fetchMock);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(writeClipboard).toHaveBeenCalledWith("## Preview");
    })
  );
  it.effect("fetches the first-party markdown source only when copying", () =>
    Effect.gen(function* () {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("## Published", { status: 200 }));
      const writeClipboard = vi.fn(() => Promise.resolve());
      yield* copy({ copySourceUrl: SOURCE_PATH, writeClipboard }, fetchMock);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith(
        new URL(SOURCE_PATH, window.location.href),
        expect.objectContaining({
          method: "GET",
          signal: expect.any(AbortSignal),
        })
      );
      expect(writeClipboard).toHaveBeenCalledWith("## Published");
    })
  );
  it.effect("fails when no reviewed source exists", () =>
    expectCopyFailure(
      copy({ writeClipboard: vi.fn() }),
      "OPEN_CONTENT_SOURCE_MISSING"
    )
  );
  it.effect("models network failures", () =>
    expectCopyFailure(
      copy(
        { copySourceUrl: SOURCE_PATH, writeClipboard: vi.fn() },
        vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))
      ),
      "OPEN_CONTENT_SOURCE_FETCH_FAILED"
    )
  );
  it.effect("times out a source request that never settles", () =>
    Effect.gen(function* () {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockImplementation(() => new Promise<Response>(() => undefined));
      const fiber = yield* expectCopyFailure(
        copy(
          { copySourceUrl: SOURCE_PATH, writeClipboard: vi.fn() },
          fetchMock
        ),
        "OPEN_CONTENT_SOURCE_FETCH_FAILED"
      ).pipe(Effect.forkChild);

      yield* Effect.yieldNow;
      const fetchSignal = fetchMock.mock.calls[0]?.[1]?.signal;
      expect(fetchSignal).toBeDefined();
      yield* TestClock.adjust("10 seconds");
      yield* Fiber.join(fiber);

      expect(fetchSignal?.aborted).toBe(true);
    })
  );
  it.effect("rejects unsuccessful source responses", () =>
    expectCopyFailure(
      copy(
        { copySourceUrl: SOURCE_PATH, writeClipboard: vi.fn() },
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(null, { status: 404 }))
      ),
      "OPEN_CONTENT_SOURCE_REJECTED"
    )
  );
  it.effect("models source body read failures", () =>
    expectCopyFailure(
      copy(
        { copySourceUrl: SOURCE_PATH, writeClipboard: vi.fn() },
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(
            new ReadableStream({
              /** Fails before the source body yields any bytes. */
              pull(controller) {
                controller.error(new Error("unreadable"));
              },
            }),
            { status: 200 }
          )
        )
      ),
      "OPEN_CONTENT_SOURCE_READ_FAILED"
    )
  );
  it.effect("rejects empty published source", () =>
    expectCopyFailure(
      copy(
        { copySourceUrl: SOURCE_PATH, writeClipboard: vi.fn() },
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response("  \n", { status: 200 }))
      ),
      "OPEN_CONTENT_SOURCE_EMPTY"
    )
  );
  it.effect("waits for and models clipboard rejection", () =>
    Effect.gen(function* () {
      const writeClipboard = vi.fn(() =>
        Promise.reject(new Error("clipboard denied"))
      );
      yield* expectCopyFailure(
        copy({ content: "## Source", writeClipboard }),
        "OPEN_CONTENT_CLIPBOARD_FAILED"
      );
    })
  );
});
function expectCopyFailure(
  program: Effect.Effect<void, OpenContentCopyError>,
  code: OpenContentCopyError["code"]
) {
  return Effect.gen(function* () {
    const failure = yield* Effect.flip(program);
    expect(failure).toBeInstanceOf(OpenContentCopyError);
    expect(failure).toEqual(expect.objectContaining({ code }));
  });
}
