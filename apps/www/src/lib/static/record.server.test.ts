// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { PRERENDER_HEADER, readStaticCalls } from "@/lib/static/calls";
import { staticCallKey } from "@/lib/static/key";
import {
  attachStaticCalls,
  isPrerenderRequest,
  recordStaticCall,
} from "@/lib/static/record.server";

/** Start's request context of the render under test: the prerender header it reads and the headers it appends. */
const appendResponseHeader = vi.hoisted(() => vi.fn());
const getRequestHeader = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start/server", () => ({
  appendResponseHeader,
  getRequestHeader,
}));

beforeEach(() => {
  appendResponseHeader.mockReset();
  getRequestHeader.mockReset();
});

/** The page answer of one render, with the call headers that its loaders appended. */
function pageAnswer(): Response {
  const headers = new Headers({ "content-type": "text/html" });
  for (const [name, value] of appendResponseHeader.mock.calls) {
    headers.append(String(name), String(value));
  }
  return new Response("<html></html>", { headers, status: 200 });
}

const prerender = new Request("https://nakafa.com/id", {
  headers: { [PRERENDER_HEADER]: "1" },
});

describe("lib/static/record.server", () => {
  it("tells the build's prerender of a page from a visitor's request", () => {
    getRequestHeader.mockReturnValue("1");
    expect(isPrerenderRequest()).toBe(true);
    getRequestHeader.mockReturnValue(undefined);
    expect(isPrerenderRequest()).toBe(false);
  });

  it.effect("records nothing for a visitor's request", () =>
    Effect.gen(function* () {
      yield* recordStaticCall("/_serverFn/messages", { locale: "id" });

      expect(appendResponseHeader).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "moves the calls of a prerendered page from its headers into its closing comment",
    () =>
      Effect.gen(function* () {
        getRequestHeader.mockReturnValue("1");
        yield* recordStaticCall("/_serverFn/messages", { locale: "id" });
        yield* recordStaticCall("/_serverFn/material", { lesson: "pecahan" });

        const answer = yield* attachStaticCalls(prerender, pageAnswer());
        const read = Option.getOrThrow(
          readStaticCalls(yield* Effect.promise(() => answer.text()))
        );

        expect(read.html).toBe("<html></html>");
        expect(read.calls).toEqual([
          {
            data: { locale: "id" },
            key: yield* staticCallKey("/_serverFn/messages", { locale: "id" }),
            url: "/_serverFn/messages",
          },
          {
            data: { lesson: "pecahan" },
            key: yield* staticCallKey("/_serverFn/material", {
              lesson: "pecahan",
            }),
            url: "/_serverFn/material",
          },
        ]);
        expect(answer.headers.get("x-nakafa-static-call")).toBeNull();
        expect(answer.headers.get("content-type")).toBe("text/html");
      })
  );

  it.effect(
    "closes a prerendered page that made no call, or an unreadable one, with an empty list",
    () =>
      Effect.gen(function* () {
        const plain = yield* attachStaticCalls(prerender, pageAnswer());
        const broken = yield* attachStaticCalls(
          prerender,
          new Response("<html></html>", {
            headers: { "x-nakafa-static-call": "%%%" },
          })
        );

        for (const answer of [plain, broken]) {
          const read = Option.getOrThrow(
            readStaticCalls(yield* Effect.promise(() => answer.text()))
          );
          expect(read.calls).toEqual([]);
        }
      })
  );

  it.effect("passes a visitor's answer unchanged", () =>
    Effect.gen(function* () {
      const answer = pageAnswer();

      expect(
        yield* attachStaticCalls(new Request("https://nakafa.com/id"), answer)
      ).toBe(answer);
    })
  );
});
