import { Ref } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { rankModel } from "@repo/backend/scripts/knowledge/convex";
import { Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";

const config = { accessToken: "test-token", url: "https://test.convex.cloud" };
const input = {
  locale: "id",
  model: "google/gemini-embedding-2",
  questions: [
    {
      contentKey: "material/lesson/mathematics/matrix/matrix-addition",
      ordinal: 5,
      question: "Bisakah dua matriks yang berbeda ukuran dijumlahkan?",
    },
  ],
} satisfies Parameters<typeof rankModel>[1];
const ranked = {
  kind: "ranked",
  pool: 3189,
  refused: 0,
  verdicts: [
    { milliseconds: 41, section: { heading: "Matriks", rank: 2 } },
    { milliseconds: 38, section: null },
  ],
};

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

/** Puts the question to the deployment through the controlled fetch. */
function call() {
  return rankModel(config, input).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

beforeEach(() => {
  fetcher.mockReset();
});

describe("model test deployment boundary", () => {
  it("calls the function under the name that the deployment registers it by", () => {
    expect(
      Ref.getConvexFunctionName(refs.internal.contents.sections.compare.rank)
    ).toBe("contents/sections/compare:rank");
  });

  it.effect(
    "sends one authenticated call to the any-type endpoint, which serves internal functions, and decodes its answer",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(
          Response.json({ status: "success", value: ranked })
        );
        expect(yield* call()).toEqual(ranked);
        expect(fetcher).toHaveBeenCalledExactlyOnceWith(
          new URL(
            "https://test.convex.cloud/api/run/contents/sections/compare/rank"
          ),
          expect.objectContaining({
            headers: {
              authorization: "Convex test-token",
              "content-type": "application/json",
            },
            method: "POST",
          })
        );
        expect(
          yield* Effect.promise(
            (): Promise<unknown> =>
              new Response(fetcher.mock.calls[0]?.[1]?.body).json()
          )
        ).toEqual({ args: input, format: "json" });
      })
  );

  it.effect("decodes the answer that the index holds no section", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(
        Response.json({ status: "success", value: { kind: "empty" } })
      );
      expect(yield* call()).toEqual({ kind: "empty" });
    })
  );

  it.effect.each([
    {
      body: { status: "error", errorMessage: "Server Error" },
      message: "Server Error",
    },
    {
      body: {
        status: "error",
        errorData: { _tag: "GatewayFailure", reason: "invalid" },
        errorMessage: "Uncaught ConvexError",
      },
      message:
        'Uncaught ConvexError {"_tag":"GatewayFailure","reason":"invalid"}',
    },
    { body: { status: "error" }, message: "Unknown Convex error" },
  ])("reports a failure of the function: $message", ({ body, message }) =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(Response.json(body));
      expect(yield* Effect.flip(call())).toMatchObject({
        _tag: "KnowledgeConvexError",
        message,
      });
    })
  );

  it.effect.each([
    { body: { status: "unknown" }, label: "an envelope Convex does not use" },
    {
      body: { status: "success", value: { kind: "ranked" } },
      label: "a value the function does not declare",
    },
  ])("rejects $label", ({ body }) =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(Response.json(body));
      expect(yield* Effect.flip(call())).toMatchObject({
        _tag: "KnowledgeConvexError",
        message: expect.any(String),
      });
    })
  );

  it.effect.each([
    {
      message: "offline",
      respond: () => fetcher.mockRejectedValue(new Error("offline")),
    },
    {
      message: "HTTP 401 unauthorized",
      respond: () =>
        fetcher.mockResolvedValue(
          new Response("unauthorized", { status: 401 })
        ),
    },
    {
      message: "body interrupted",
      respond: () =>
        fetcher.mockResolvedValue(
          new Response(
            new ReadableStream({
              /** Fails before the error body yields any bytes. */
              pull(controller) {
                controller.error(new Error("body interrupted"));
              },
            }),
            { status: 403 }
          )
        ),
    },
    {
      message: "",
      respond: () => fetcher.mockResolvedValue(new Response("{")),
    },
  ])(
    "reports a request that gave no answer: $message",
    ({ message, respond }) =>
      Effect.gen(function* () {
        respond();
        expect(yield* Effect.flip(call())).toMatchObject({
          _tag: "KnowledgeConvexError",
          message: expect.stringContaining(message),
        });
      })
  );

  it.effect(
    "gives up on a deployment that does not answer in five minutes",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(
          () => new Promise<Response>(() => undefined)
        );
        const fiber = yield* Effect.forkChild(Effect.flip(call()));
        yield* TestClock.adjust("5 minutes");
        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: "KnowledgeConvexError",
          message: "The deployment did not answer within 5 minutes.",
        });
        expect(fetcher).toHaveBeenCalledOnce();
      })
  );
});
