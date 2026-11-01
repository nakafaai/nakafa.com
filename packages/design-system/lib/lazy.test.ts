import { afterEach, describe, expect, it } from "@effect/vitest";
import { lazy, readChunk } from "@repo/design-system/lib/lazy";
import { Effect, Fiber, MutableList } from "effect";
import { createElement, Suspense } from "react";
import { renderToReadableStream } from "react-dom/server";

const CHUNK_GONE = new TypeError("Failed to fetch dynamically imported module");

describe("readChunk", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect("answers a chunk that loads", () =>
    Effect.gen(function* () {
      expect(yield* readChunk(() => Promise.resolve("chunk"))).toBe("chunk");
    })
  );

  it.live("waits for the network and loads again", () =>
    Effect.gen(function* () {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      const load = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(CHUNK_GONE)
        .mockResolvedValueOnce("chunk");

      const waiting = yield* Effect.forkChild(readChunk(load));
      yield* Effect.sleep("10 millis");
      expect(load).toHaveBeenCalledOnce();

      window.dispatchEvent(new Event("online"));

      expect(yield* Fiber.join(waiting)).toBe("chunk");
      expect(load).toHaveBeenCalledTimes(2);
    })
  );

  it.live("stops listening when the read is interrupted", () =>
    Effect.gen(function* () {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      const removal = vi.spyOn(window, "removeEventListener");

      const waiting = yield* Effect.forkChild(
        readChunk(() => Promise.reject(CHUNK_GONE))
      );
      yield* Effect.sleep("10 millis");
      yield* Fiber.interrupt(waiting);

      expect(removal).toHaveBeenCalledWith("online", expect.any(Function));
    })
  );
});

describe("lazy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.live("hands React the failure as the import threw it", () =>
    Effect.gen(function* () {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      const failures = MutableList.make<unknown>();
      const Chunk = lazy(() =>
        Promise.reject<{ default: () => null }>(CHUNK_GONE)
      );
      yield* Effect.promise(async () => {
        const stream = await renderToReadableStream(
          createElement(Suspense, { fallback: null }, createElement(Chunk)),
          {
            onError: (failure) => {
              MutableList.append(failures, failure);
            },
          }
        );
        await stream.allReady;
      });

      expect(MutableList.toArray(failures)[0]).toBe(CHUNK_GONE);
    })
  );

  it.live("renders what its chunk holds", () =>
    Effect.gen(function* () {
      const Chunk = lazy(() =>
        Promise.resolve({ default: () => createElement("p", null, "loaded") })
      );
      const html = yield* Effect.promise(async () => {
        const stream = await renderToReadableStream(
          createElement(Suspense, { fallback: null }, createElement(Chunk))
        );
        await stream.allReady;
        return new Response(stream).text();
      });

      expect(html).toContain("loaded");
    })
  );
});
