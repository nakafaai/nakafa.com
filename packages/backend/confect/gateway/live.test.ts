import { afterEach, describe, expect, it } from "@effect/vitest";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { Space } from "@repo/backend/confect/space";
import { ConfigProvider, Effect, Layer, Result, Schema } from "effect";

const space = Schema.decodeUnknownSync(Space)({
  kind: "personal",
  userId: "user-1",
});
const answer = {
  content: [{ type: "text", text: "Hello" }],
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
  warnings: [],
};

/** Runs an effect on the production layer under one deployed key value. */
function deployed(apiKey: string | undefined) {
  return Effect.provide(
    GatewayLive.pipe(
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({ AI_GATEWAY_API_KEY: apiKey })
        )
      )
    )
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("The production gateway", () => {
  it.effect.each([undefined, "", "   "])(
    "fails before any request when the key is %j",
    (apiKey) =>
      Effect.gen(function* () {
        const fetch = vi.fn<typeof globalThis.fetch>();
        vi.stubGlobal("fetch", fetch);
        const result = yield* Effect.service(Gateway).pipe(
          deployed(apiKey),
          Effect.result
        );
        expect(Result.isFailure(result) && result.failure).toMatchObject({
          _tag: "GatewayConfigurationError",
          message: "AI Gateway is not configured.",
        });
        expect(fetch).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "sends each call to the Vercel AI Gateway with the key, attribution, and route",
    () =>
      Effect.gen(function* () {
        const fetch = vi.fn<typeof globalThis.fetch>(() =>
          Promise.resolve(Response.json(answer))
        );
        vi.stubGlobal("fetch", fetch);
        const handle = (yield* Gateway).language({
          purpose: "specialist",
          model: "nakafa-pro",
          space,
        });
        const result = yield* Effect.promise(() =>
          handle.model.doGenerate({
            prompt: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
            providerOptions: { gateway: { only: ["openai"] } },
          })
        );
        expect(result.content).toEqual(answer.content);
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0] ?? [];
        expect(url).toBe("https://ai-gateway.vercel.sh/v4/ai/language-model");
        expect(init?.headers).toMatchObject({
          authorization: "Bearer private-test-key",
          "ai-language-model-id": "google/gemini-3.7-flash",
          "http-referer": "https://nakafa.com",
          "x-title": "nakafa.com",
        });
        expect(JSON.parse(String(init?.body))).toMatchObject({
          providerOptions: {
            gateway: {
              disallowPromptTraining: true,
              only: ["google", "vertex"],
              sort: "ttft",
              tags: ["space:personal", "purpose:specialist"],
            },
            google: { thinkingConfig: { thinkingLevel: "low" } },
          },
        });
      }).pipe(deployed("private-test-key"))
  );
});
