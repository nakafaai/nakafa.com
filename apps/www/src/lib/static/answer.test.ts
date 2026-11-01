import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import { readStaticAnswer } from "@/lib/static/answer";
import { staticDataPath, toStaticFile } from "@/lib/static/calls";
import { staticCallKey } from "@/lib/static/key";

const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

beforeEach(() => {
  fetcher.mockReset();
});

const URL_OF_FN = "/_serverFn/messages";
const DATA = { locale: "id" };

describe("lib/static/answer", () => {
  it.effect(
    "reads a prerendered answer from its static file as the server function's own answer",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(
          new Response(
            toStaticFile(
              "application/json",
              new TextEncoder().encode('{"t":1}')
            )
          )
        );

        const answer = Option.getOrThrow(
          yield* readStaticAnswer(URL_OF_FN, DATA)
        );

        const [request] = fetcher.mock.calls[0] ?? [];
        expect(new URL(String(request)).pathname).toBe(
          staticDataPath(yield* staticCallKey(URL_OF_FN, DATA))
        );
        expect(answer.headers.get("content-type")).toBe("application/json");
        expect(answer.headers.get("x-tss-serialized")).toBe("true");
        expect(yield* Effect.promise(() => answer.text())).toBe('{"t":1}');
      })
  );

  it.effect("reads one answer from the network once", () =>
    Effect.gen(function* () {
      const data = { locale: "en" };
      fetcher.mockImplementation(() =>
        Promise.resolve(
          new Response(
            toStaticFile("application/json", new TextEncoder().encode("[1]"))
          )
        )
      );

      for (const _ of [1, 2]) {
        const answer = Option.getOrThrow(
          yield* readStaticAnswer(URL_OF_FN, data)
        );
        expect(yield* Effect.promise(() => answer.text())).toBe("[1]");
      }

      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect("keeps a bounded number of answers", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(() =>
        Promise.resolve(
          new Response(
            toStaticFile("application/json", new TextEncoder().encode("[2]"))
          )
        )
      );

      for (const page of Arr.range(0, 256)) {
        yield* readStaticAnswer(URL_OF_FN, { page });
      }
      fetcher.mockClear();
      yield* readStaticAnswer(URL_OF_FN, { page: 0 });

      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "reads a missing file, an unreadable one and a failed request as none",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValueOnce(new Response("", { status: 404 }));
        fetcher.mockResolvedValueOnce(new Response(new Uint8Array([1, 2])));
        fetcher.mockRejectedValueOnce(new TypeError("offline"));

        for (let attempt = 0; attempt < 3; attempt += 1) {
          expect(Option.isNone(yield* readStaticAnswer(URL_OF_FN, DATA))).toBe(
            true
          );
        }
      })
  );
});
