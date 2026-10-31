// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { readBuildEntry, writeBuildEntry } from "@/lib/content/store/build";

const STORE = "http://127.0.0.1:4179";
const KEY = "a".repeat(64);

/** One fetch double for the whole file, because the client keeps the first global it reads. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("NAKAFA_BUILD_STORE", STORE);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** The address and the method of the one request that the store received. */
function sentRequest() {
  const [input, init] = fetcher.mock.calls[0] ?? [];
  return { method: init?.method, url: String(input) };
}

describe("readBuildEntry", () => {
  it.effect("answers an entry the store keeps", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response('{"value":"lesson"}'));

      const entry = yield* readBuildEntry(KEY);

      expect(entry).toEqual(Option.some({ value: "lesson" }));
      expect(sentRequest()).toEqual({
        method: "GET",
        url: `${STORE}/${KEY}`,
      });
    })
  );

  it.effect("answers none for an entry the store lacks", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));

      expect(yield* readBuildEntry(KEY)).toEqual(Option.none());
    })
  );

  it.effect("answers none when the store cannot be reached", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));

      expect(yield* readBuildEntry(KEY)).toEqual(Option.none());
    })
  );

  it.effect("asks nothing outside a deploy", () =>
    Effect.gen(function* () {
      vi.stubEnv("NAKAFA_BUILD_STORE", undefined);

      expect(yield* readBuildEntry(KEY)).toEqual(Option.none());
      expect(fetcher).not.toHaveBeenCalled();
    })
  );
});

describe("writeBuildEntry", () => {
  it.effect("keeps an entry as its JSON text", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));

      yield* writeBuildEntry(KEY, { value: "lesson" });

      expect(sentRequest()).toEqual({
        method: "PUT",
        url: `${STORE}/${KEY}`,
      });
    })
  );

  it.effect(
    "leaves the caller its value when the store cannot be reached",
    () =>
      Effect.gen(function* () {
        fetcher.mockRejectedValueOnce(new TypeError("fetch failed"));

        yield* writeBuildEntry(KEY, { value: "lesson" });

        expect(fetcher).toHaveBeenCalledOnce();
      })
  );

  it.effect("sends nothing outside a deploy", () =>
    Effect.gen(function* () {
      vi.stubEnv("NAKAFA_BUILD_STORE", undefined);

      yield* writeBuildEntry(KEY, { value: "lesson" });

      expect(fetcher).not.toHaveBeenCalled();
    })
  );
});
