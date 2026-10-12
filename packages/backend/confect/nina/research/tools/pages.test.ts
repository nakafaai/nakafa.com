import { beforeEach, describe, expect, it } from "@effect/vitest";
import { readTopPages } from "@repo/backend/confect/nina/research/tools/pages";
import { readsPages } from "@repo/backend/test/nina/pages";
import { Array as Arr, Effect, HashMap, Option } from "effect";

const readPage = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/confect/nina/research/tools/scrape", () => ({
  readPage,
}));

/** A search result at an address, as the search returns it. */
function result(name: string) {
  return {
    content: "",
    description: `Kurikulum ${name}.`,
    title: `Kurikulum ${name}`,
    url: `https://example.com/${name}`,
  };
}

/** The addresses of the pages read so far, in the order they were asked for. */
function readAddresses() {
  return Arr.map(readPage.mock.calls, ([url]) => url);
}

describe("research result pages", () => {
  beforeEach(() => {
    readPage.mockReset();
    readPage.mockImplementation(readsPages({}));
  });

  it.effect("reads every query's first result before any second result", () =>
    Effect.gen(function* () {
      yield* readTopPages(
        [
          [result("a1"), result("a2")],
          [result("b1"), result("b2")],
        ],
        "kurikulum"
      );

      expect(readAddresses()).toEqual([
        "https://example.com/a1",
        "https://example.com/b1",
      ]);
    })
  );

  it.effect("reads an address once, however many queries find it", () =>
    Effect.gen(function* () {
      yield* readTopPages(
        [
          [result("a"), result("b")],
          [result("a"), result("c")],
        ],
        "kurikulum"
      );

      expect(readAddresses()).toEqual([
        "https://example.com/a",
        "https://example.com/b",
      ]);
      expect(readPage).toHaveBeenCalledWith("https://example.com/a", {
        deadlineMs: 10_000,
        timeoutMs: 8000,
      });
    })
  );

  it.effect(
    "returns the text of each page it read by address, and nothing for a page it could not read in time",
    () =>
      Effect.gen(function* () {
        readPage.mockImplementation(
          readsPages({ "https://example.com/a": "Text of page a." })
        );
        const pages = yield* readTopPages(
          [[result("a"), result("b")]],
          "kurikulum"
        );

        expect(HashMap.get(pages, "https://example.com/a")).toEqual(
          Option.some("Text of page a.")
        );
        expect(HashMap.has(pages, "https://example.com/b")).toBe(false);
      })
  );

  it.effect(
    "keeps the paragraphs of a long page that hold the words of the task",
    () =>
      Effect.gen(function* () {
        const relevant = "Kurikulum merdeka dipakai di sekolah. ".repeat(24);
        readPage.mockImplementation(
          readsPages({
            "https://example.com/a": Arr.join(
              [
                "Cuaca cerah hari ini. ".repeat(40),
                relevant,
                "Pasar buka pagi hari. ".repeat(40),
              ],
              "\n\n"
            ),
          })
        );
        const pages = yield* readTopPages(
          [[result("a")]],
          "# Request\n\nkurikulum merdeka"
        );

        expect(HashMap.get(pages, "https://example.com/a")).toEqual(
          Option.some(relevant.trim())
        );
      })
  );
});
