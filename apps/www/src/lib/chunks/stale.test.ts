import { describe, expect, it } from "@effect/vitest";
import { Effect, MutableHashMap, Option } from "effect";
import { isStaleChunkError, reloadForStaleChunk } from "@/lib/chunks/stale";

const CHROMIUM = new TypeError(
  "Failed to fetch dynamically imported module: https://nakafa.com/assets/schools-DhyL3sKZ.js"
);

/** A tab's storage that holds what the page wrote, and a reload that counts itself. */
function tab() {
  const values = MutableHashMap.empty<string, string>();
  const storage = {
    getItem: (key: string) => Option.getOrNull(MutableHashMap.get(values, key)),
    setItem: (key: string, value: string) => {
      MutableHashMap.set(values, key, value);
    },
  };
  const reload = vi.fn();
  return { reload, storage };
}

describe("stale chunks", () => {
  it("recognizes the missing chunk of every browser and nothing else", () => {
    expect(isStaleChunkError(CHROMIUM)).toBe(true);
    expect(
      isStaleChunkError(
        new TypeError(
          "error loading dynamically imported module: https://nakafa.com/assets/a.js"
        )
      )
    ).toBe(true);
    expect(
      isStaleChunkError(new TypeError("Importing a module script failed."))
    ).toBe(true);
    expect(isStaleChunkError(new Error("Something else failed"))).toBe(false);
    expect(
      isStaleChunkError("Failed to fetch dynamically imported module")
    ).toBe(false);
  });

  it.effect("reloads once for a missing chunk, then lets its error show", () =>
    Effect.gen(function* () {
      const { reload, storage } = tab();

      expect(yield* reloadForStaleChunk(CHROMIUM, storage, reload)).toBe(true);
      expect(yield* reloadForStaleChunk(CHROMIUM, storage, reload)).toBe(false);
      expect(reload).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("never reloads when the tab cannot keep the mark", () =>
    Effect.gen(function* () {
      const reload = vi.fn();
      const storage = {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("full", "QuotaExceededError");
        },
      };

      expect(yield* reloadForStaleChunk(CHROMIUM, storage, reload)).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    })
  );

  it.effect("never reloads when the tab's storage refuses", () =>
    Effect.gen(function* () {
      const reload = vi.fn();
      const storage = {
        getItem: (): string | null => {
          throw new DOMException("denied", "SecurityError");
        },
        setItem: vi.fn(),
      };

      expect(yield* reloadForStaleChunk(CHROMIUM, storage, reload)).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    })
  );
});
