// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { readSearchIndex } from "@/lib/search/load";
import { INDONESIAN_ENTRIES } from "@/lib/search/test.entries";

const ORIGIN = "https://nakafa.com";

/** One fetch double for the whole file, provided to the module's own client. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/** Reads the Indonesian index through this file's fetch double. */
function read() {
  return readSearchIndex(ORIGIN, "id").pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("readSearchIndex", () => {
  it.effect("reads the locale's static index and folds every entry once", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValueOnce(
        Response.json({ entries: INDONESIAN_ENTRIES })
      );
      const index = yield* read();
      expect(String(fetcher.mock.calls[0]?.[0])).toBe(
        `${ORIGIN}/search/id.json`
      );
      expect(index.entries).toEqual(INDONESIAN_ENTRIES);
      expect(index.prepared).toHaveLength(INDONESIAN_ENTRIES.length);
    })
  );

  it.effect(
    "fails with the reason: no answer, a missing file, or a body that is no index",
    () =>
      Effect.gen(function* () {
        fetcher.mockRejectedValueOnce(new TypeError("offline"));
        expect((yield* Effect.flip(read())).reason).toBe("fetch");
        fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
        expect((yield* Effect.flip(read())).reason).toBe("status");
        fetcher.mockResolvedValueOnce(
          Response.json({ entries: [{ title: 1 }] })
        );
        expect((yield* Effect.flip(read())).reason).toBe("body");
      })
  );
});
