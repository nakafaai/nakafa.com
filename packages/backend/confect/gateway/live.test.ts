import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { Space } from "@repo/backend/confect/space";
import { Effect, Result, Schema } from "effect";

const serviceToken = vi.hoisted(() => vi.fn<() => Promise<string>>());
vi.mock("convex/server", () => ({ getServiceToken: serviceToken }));

const space = Schema.decodeUnknownSync(Space)({
  kind: "personal",
  userId: "user-1",
});
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
    "sends a %s call to the Convex AI gateway with reasoning effort %s",
    ([purpose, effort]) => {
      // The layer reads the service token when it is built, before the body runs.
      serviceToken.mockResolvedValue("service-token");
      fetch.mockResolvedValue(Response.json(completion));
      return Effect.gen(function* () {
        const handle = (yield* Gateway).language({
          purpose,
          model: "nakafa-pro",
          space,
        });
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
        const body = yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(Schema.Unknown)
        )(init?.body);
        expect(body).toMatchObject({
          model: "google/gemini-3.7-flash",
          reasoning_effort: effort,
        });
      }).pipe(deployed);
    }
  );
});
