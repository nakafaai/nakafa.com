import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { purposes } from "@repo/backend/confect/gateway/purpose";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Effect, Option, Result, Schema, Stream } from "effect";

const serviceToken = vi.hoisted(() => vi.fn<() => Promise<string>>());
vi.mock("convex/server", () => ({ getServiceToken: serviceToken }));

const prompt = [
  { role: "user" as const, content: [{ type: "text" as const, text: "Hi" }] },
];
const completion = {
  id: "chatcmpl-test",
  object: "chat.completion",
  created: 0,
  model: "google/gemini-3.7-flash",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hello" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
};

/**
 * A streamed answer as the gateway sent it on 8 October 2026 for a request
 * without `stream_options`: the last chunk carries the usage and the cost.
 */
const chunks = [
  {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 0,
    model: "google/gemini-3.7-flash",
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: "Hello" },
        finish_reason: null,
      },
    ],
  },
  {
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 0,
    model: "google/gemini-3.7-flash",
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content: "" },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 13,
      completion_tokens: 9,
      total_tokens: 22,
      cost: 0.000_026_4,
    },
  },
];
const events = `${Arr.join(
  Arr.map(chunks, (chunk) => `data: ${encodeJsonText(chunk)}\n\n`),
  ""
)}data: [DONE]\n\n`;

/** What the Decisions route answers for one yes-or-no question, which the HTTP API calls `noul`. */
const decision = {
  id: "decision-test",
  model: "typesafe/jev-1.13",
  answers: { lasting: { type: "noul", noul: 0.95 } },
  usage: { input_tokens: 12, output_tokens: 1, cost: 0.000_01 },
};

/** The one fetch double this file stubs globally and resets between tests. */
const fetch = vi.fn<typeof globalThis.fetch>();

beforeEach(() => vi.stubGlobal("fetch", fetch));
afterEach(() => {
  vi.unstubAllGlobals();
  serviceToken.mockReset();
  fetch.mockReset();
});

/** Runs an effect on the production layer. */
const deployed = Effect.provide(GatewayLive);

describe("The production gateway", () => {
  it.effect(
    "fails before any request when the deployment cannot read a service token",
    () =>
      Effect.gen(function* () {
        serviceToken.mockRejectedValueOnce(new Error("private deployment"));
        const result = yield* Effect.service(Gateway).pipe(
          deployed,
          Effect.result
        );
        expect(Result.isFailure(result) && result.failure).toMatchObject({
          _tag: "GatewayConfigurationError",
          message: "The AI gateway is not available on this deployment.",
        });
        expect(fetch).not.toHaveBeenCalled();
      })
  );

  it.effect.each([
    ["specialist", "low"],
    ["chat", "high"],
  ] as const)(
    "sends a %s call to the Convex AI gateway with reasoning effort %s and the purpose's output cap as max_tokens",
    ([purpose, effort]) => {
      // The layer reads the service token when it is built, before the body runs.
      serviceToken.mockResolvedValue("service-token");
      fetch.mockResolvedValue(Response.json(completion));
      return Effect.gen(function* () {
        const handle = (yield* Gateway).language(purpose);
        const result = yield* Effect.promise(() =>
          handle.model.doGenerate({ prompt })
        );
        expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0] ?? [];
        expect(url).toBe("https://ai-gateway.convex.dev/v1/chat/completions");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer service-token"
        );
        const body = yield* Schema.decodeUnknownEffect(JsonTextSchema)(
          init?.body
        );
        expect(body).toMatchObject({
          max_tokens: purposes[purpose].maxOutputTokens,
          model: "google/gemini-3.8-flash",
          reasoning_effort: effort,
        });
      }).pipe(deployed);
    }
  );

  it.effect(
    "sends a decision to the Convex AI gateway's decisions route with the zero retention request, and reads the probability back",
    () => {
      serviceToken.mockResolvedValue("service-token");
      fetch.mockResolvedValue(Response.json(decision));
      return Effect.gen(function* () {
        const answers = yield* (yield* Gateway).decide("Kelas 12 IPA.", {
          lasting: { type: "boolean", instructions: "Does it last?" },
        });
        expect(answers).toEqual({
          lasting: { type: "boolean", probability: 0.95 },
        });
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0] ?? [];
        expect(url).toBe("https://ai-gateway.convex.dev/alpha/decisions");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer service-token"
        );
        const body = yield* Schema.decodeUnknownEffect(JsonTextSchema)(
          init?.body
        );
        expect(body).toEqual({
          model: "typesafe/jev-1.13",
          provider: { zdr: true },
          questions: {
            lasting: { type: "noul", instructions: "Does it last?" },
          },
          state: [{ type: "text", text: "Kelas 12 IPA." }],
        });
      }).pipe(deployed);
    }
  );

  it.effect(
    "reports the tokens and the cost of a streamed answer from its last chunk",
    () => {
      serviceToken.mockResolvedValue("service-token");
      fetch.mockResolvedValue(
        new Response(events, {
          headers: { "content-type": "text/event-stream" },
        })
      );
      return Effect.gen(function* () {
        const handle = (yield* Gateway).language("chat");
        const { stream } = yield* Effect.promise(() =>
          handle.model.doStream({ prompt })
        );
        const parts = yield* Stream.runCollect(
          Stream.fromReadableStream({
            evaluate: () => stream,
            onError: () => new GatewayFailure({ reason: "network" }),
          })
        );
        const finish = Arr.findFirst(parts, (part) => part.type === "finish");
        expect(Option.getOrUndefined(finish)).toMatchObject({
          usage: { inputTokens: { total: 13 }, outputTokens: { total: 9 } },
          providerMetadata: { convexGateway: { cost: 0.000_026_4 } },
        });
        const [, init] = fetch.mock.calls[0] ?? [];
        const body = yield* Schema.decodeUnknownEffect(JsonTextSchema)(
          init?.body
        );
        expect(body).toMatchObject({ stream: true });
        expect(body).not.toHaveProperty("stream_options");
      }).pipe(deployed);
    }
  );
});
