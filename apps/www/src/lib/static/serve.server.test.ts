// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { X_TSS_SERIALIZED } from "@tanstack/react-start";
import { Effect, Option, Schema } from "effect";
import { toJSON } from "seroval";
import { staticDataPath, toStaticFile } from "@/lib/static/calls";
import { staticCallKey } from "@/lib/static/key";
import { answerStaticFunction } from "@/lib/static/serve.server";

const MESSAGES = "/_serverFn/test-route-messages";
const COUNTRY = "/_serverFn/test-tryout-country";
const ACCOUNT = "/_serverFn/test-account";

const release = vi.hoisted(() => ({ hasStaticRelease: true }));

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which the deployed Worker binds and a prerender does not. */
  env: {
    get ASSETS() {
      return release.hasStaticRelease ? assets : undefined;
    },
  },
}));

vi.mock("@/lib/i18n/messages.functions", () => ({
  readRouteMessages: { url: "/_serverFn/test-route-messages" },
}));

vi.mock("@/lib/curriculum/node.functions", () => ({
  readCurriculumRoute: { url: "/_serverFn/test-curriculum-node" },
}));

vi.mock("@/components/tryout/route/catalog.functions", () => ({
  readTryoutCountryFn: { url: "/_serverFn/test-tryout-country" },
}));

/** JSON text, as Start's client writes a call's payload. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** The address of a GET call as Start's client writes it: its input in Seroval's JSON. */
function callUrl(fn: string, data: unknown) {
  const url = new URL(fn, "https://nakafa.com");
  url.searchParams.set("payload", encodeJson(toJSON({ data })));
  return url;
}

/** Serves the static files of a release that holds one answer, at the key of one call. */
const holdAnswer = Effect.fn("test.holdAnswer")(function* (
  fn: string,
  data: unknown,
  body: string
) {
  const key = yield* staticCallKey(fn, data);
  const file = toStaticFile("application/json", new TextEncoder().encode(body));
  assets.fetch.mockImplementation(async (request) =>
    new URL(request.url).pathname === staticDataPath(key)
      ? new Response(file)
      : new Response("missing", { status: 404 })
  );
});

beforeEach(() => {
  release.hasStaticRelease = true;
  assets.fetch.mockReset();
});

describe("answerStaticFunction", () => {
  it.effect(
    "answers a static function's call from the file the build wrote for its exact input",
    () =>
      Effect.gen(function* () {
        const data = { locale: "en", namespaces: ["Auth", "Common"] };
        yield* holdAnswer(MESSAGES, data, '{"messages":true}');

        const answer = yield* answerStaticFunction(
          new Request(callUrl(MESSAGES, data))
        );

        expect(Option.isSome(answer)).toBe(true);
        const response = Option.getOrThrow(answer);
        expect(response.headers.get("content-type")).toBe("application/json");
        expect(response.headers.get(X_TSS_SERIALIZED)).toBe("true");
        expect(yield* Effect.promise(() => response.text())).toBe(
          '{"messages":true}'
        );
      })
  );

  it.effect(
    "answers none for an input the build never wrote, so the handler runs",
    () =>
      Effect.gen(function* () {
        yield* holdAnswer(
          COUNTRY,
          { country: "indonesia", locale: "id" },
          "{}"
        );

        for (const data of [
          { country: "indonesia", locale: "en" },
          { locale: "id", country: "indonesia" },
        ]) {
          const answer = yield* answerStaticFunction(
            new Request(callUrl(COUNTRY, data))
          );
          expect(answer).toEqual(Option.none());
        }
      })
  );

  it.effect(
    "answers none for a malformed payload, a function that is not static, a POST or a call without input",
    () =>
      Effect.gen(function* () {
        const data = { locale: "en", namespaces: ["Auth"] };
        yield* holdAnswer(MESSAGES, data, "{}");
        const malformed = new URL(MESSAGES, "https://nakafa.com");
        malformed.searchParams.set("payload", "{not json");
        const unread = new URL(MESSAGES, "https://nakafa.com");
        unread.searchParams.set("payload", encodeJson({ t: 7 }));
        const unknownNode = new URL(MESSAGES, "https://nakafa.com");
        unknownNode.searchParams.set(
          "payload",
          encodeJson({ f: 0, m: [], t: { t: 999 } })
        );
        const inputless = new URL(MESSAGES, "https://nakafa.com");
        inputless.searchParams.set("payload", encodeJson(toJSON("no input")));

        for (const request of [
          new Request(malformed),
          new Request(unread),
          new Request(unknownNode),
          new Request(inputless),
          new Request(callUrl(ACCOUNT, data)),
          new Request(callUrl(MESSAGES, data), { method: "POST" }),
          new Request(new URL(MESSAGES, "https://nakafa.com")),
        ]) {
          expect(yield* answerStaticFunction(request)).toEqual(Option.none());
        }
        expect(assets.fetch).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers none for a file that holds no answer and in a prerender, which binds no assets",
    () =>
      Effect.gen(function* () {
        const data = { locale: "en", namespaces: ["Auth"] };
        const key = yield* staticCallKey(MESSAGES, data);
        assets.fetch.mockResolvedValue(new Response("no line"));

        expect(
          yield* answerStaticFunction(new Request(callUrl(MESSAGES, data)))
        ).toEqual(Option.none());
        expect(
          new URL(assets.fetch.mock.calls[0]?.[0].url ?? "").pathname
        ).toBe(staticDataPath(key));

        release.hasStaticRelease = false;
        expect(
          yield* answerStaticFunction(new Request(callUrl(MESSAGES, data)))
        ).toEqual(Option.none());
      })
  );
});
